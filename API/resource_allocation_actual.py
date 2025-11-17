import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, Form, Request
from fastapi.responses import JSONResponse
from db_utils_pg import get_pg_connection, release_pg_connection
import psycopg2
from psycopg2.extras import DictCursor
from datetime import datetime, date, timedelta  # Import `date` and `timedelta` for interval calculations
from decimal import Decimal  # Import `Decimal` for isinstance checks
from io import BytesIO
from fastapi import File
from utils import convert_decimal_to_float  # Import the utility function

allocation_actual_router = APIRouter()

@allocation_actual_router.post('/allocations_actual/import_timesheet')
async def import_timesheet(
    request: Request,
    file: UploadFile = File(...),
    input_file_name: str = None,
    project_name: str = None
):
    """
    Endpoint to import timesheet data from an uploaded Excel file, with optional filtering.
    """
    print(f"Received input_file_name: {input_file_name}")
    print(f"Received project_name: {project_name}")

    try:
        # --- PATCH: Always extract form fields from request if missing ---
        if input_file_name is None or project_name is None:
            try:
                form = await request.form()
                if input_file_name is None and 'input_file_name' in form:
                    input_file_name = form['input_file_name']
                if project_name is None and 'project_name' in form:
                    project_name = form['project_name']
                print("DEBUG: Patched form extraction:", dict(form))
            except Exception as e:
                print("DEBUG: Could not extract fields from request.form():", e)
        # --- END PATCH ---

        contents = await file.read()
        excel_stream = BytesIO(contents)
        df = pd.read_excel(excel_stream)

        file_name = input_file_name or file.filename

        print(f"Processing file: {file_name}")
        print(f"Filtering for project_name: {project_name}")

        # Debug: Print all request form fields for troubleshooting
        try:
            from starlette.requests import Request
            import inspect
            frame = inspect.currentframe()
            outer_frames = inspect.getouterframes(frame)
            for f in outer_frames:
                if 'request' in f.frame.f_locals:
                    req = f.frame.f_locals['request']
                    if hasattr(req, 'form'):
                        form_data = await req.form()
                        #print("DEBUG: All form fields received:", dict(form_data))
                    break
        except Exception as e:
            print("DEBUG: Could not print all form fields:", e)

        # Check if file_name is provided
        if not file_name:
            raise HTTPException(status_code=400, detail="File name is required.")
        
        if not file_name.endswith('.xlsx'):
            raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel file.")

        result = get_import_timesheet_xls(
            df,
            file_name,
            project_name=project_name  # <-- Pass to function
        )
        return JSONResponse(content=result, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error importing timesheet: {str(e)}")

def get_import_timesheet_xls(
    df: pd.DataFrame,
    file_name: str,
    project_name: str = None
):
    """
    Processes the DataFrame and upserts data into the pmo.timesheet_entry table, with optional filtering.

    Args:
        df (pd.DataFrame): The DataFrame containing the Excel data.
        file_name (str): The name of the uploaded file.

    Returns:
        dict: A dictionary containing the status of the operation.
    """

    conn = None
    try:
        # Rename columns to match the database table
        df.rename(columns={
            'Capitalization (Project)': 'ts_capitalization_project',
            'Investment Project (Project)': 'ts_investment_project',
            'Project Start Date': 'ts_project_start_date',
            'Project End Date': 'ts_project_end_date',
            'Project Description': 'ts_project_description',
            'Project Name': 'ts_project_name',
            'Project / Task (Full Path)': 'ts_project_task',
            'Task Name': 'ts_task_name',  # Not used in the table
            'User Name': 'ts_user_name',
            'Entry Date': 'ts_entry_date',
            'Total Hrs': 'ts_total_hrs',
            'Department (Current)': 'ts_department',
            'Department Code (Current)': 'ts_department_code',
            'Project Code': 'ts_project_code'
        }, inplace=True)

        # Print DataFrame shape after each critical step for debugging
        #print(f"Initial DataFrame shape: {df.shape}")

        # Add the ts_input_file_name column with the actual file name
        df['ts_input_file_name'] = file_name

        # Replace NaN and NaT values with None
        df = df.where(pd.notnull(df), None)
        print(f"After replacing NaN/NaT with None: {df.shape}")

        # Parse other date columns as before
        for col in ['ts_project_start_date', 'ts_project_end_date']:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')

        # Print after date parsing
        #print(f"After date parsing: {df.shape}")

        # Print unique project names for troubleshooting
        #print("Unique project names in Excel:", df['ts_project_name'].unique())

        # --- ENFORCE CASE-INSENSITIVE, TRIMMED PROJECT NAME FILTER ---
        # Debug: Print the type and value of project_name before filtering
        print(f"DEBUG: project_name type: {type(project_name)}, value: {repr(project_name)}")
        # Debug: Print DataFrame columns to ensure 'ts_project_name' exists
        print(f"DEBUG: DataFrame columns: {df.columns.tolist()}")

        # Remove rows where ts_entry_date is NaT before filtering
        df = df[df['ts_entry_date'].notnull()].copy()
        print(f"After removing null ts_entry_date: {df.shape}")

        # --- STRICT project_name filter (case-insensitive, trimmed) ---
        if project_name is not None and str(project_name).strip() != "":
            print(f"Filtering for project_name: '{project_name}' (case-insensitive, trimmed)")
            #print("Unique project names in Excel before filter:", df['ts_project_name'].unique())
            df = df[df['ts_project_name'].astype(str).str.strip().str.lower() == str(project_name).strip().lower()].copy()
            #print(f"After project_name filter: {df.shape}")
            #print("Filtered project names:", df['ts_project_name'].unique())
            #print("Filtered DataFrame (first 10 rows):")
            #print(df.head(10))
        else:
            print("No project_name filter applied.")

        if df.empty:
            print("No rows matched the filter criteria.")
            return {"message": "No timesheet data matched the filter criteria."}


        # Establish a database connection
        conn = get_pg_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()

        # Prepare lookups for project_id and resource_id
        # Fetch all project_name -> project_id
        cursor.execute("SELECT timesheet_project_name, project_id FROM pmo.projects")
        project_map = {row[0]: row[1] for row in cursor.fetchall()}
        # Fetch all timesheet_resource_name -> resource_id
        cursor.execute("SELECT timesheet_resource_name, resource_id FROM pmo.resources")
        resource_map = {row[0]: row[1] for row in cursor.fetchall()}

        # --- Convert all date fields to string for DB insert ---
        date_fields = ['ts_entry_date', 'ts_project_start_date', 'ts_project_end_date']
        for col in date_fields:
            if col in df.columns:
                df[col] = df[col].apply(
                    lambda x: x.strftime('%Y-%m-%d') if pd.notnull(x) and isinstance(x, (datetime, date)) else (str(x) if pd.notnull(x) else None)
                )

        # Upsert data into the pmo.timesheet_entry table
        inserted_rows = 0
        accepted_rows = []
        for _, row in df.iterrows():
            project_id = project_map.get(row['ts_project_name'])
            resource_id = resource_map.get(row['ts_user_name'])
            if project_id is None or resource_id is None:
                # Print skipped rows for debug
                #print(f"Skipping row: project_id={project_id}, resource_id={resource_id}, project_name={row['ts_project_name']}, user_name={row['ts_user_name']}")
                continue
            # Print accepted row for debug, including entry_date from Excel (as original datetime)
            accepted_rows.append({
                "ts_project_name": row['ts_project_name'],
                "ts_user_name": row['ts_user_name'],
                "ts_entry_date": row['ts_entry_date'],
                "ts_project_start_date": row.get('ts_project_start_date'),
                "ts_project_end_date": row.get('ts_project_end_date'),
                "project_id": project_id,
                "resource_id": resource_id
            })
            cursor.execute("""
                INSERT INTO pmo.timesheet_entry (
                    ts_capitalization_project,
                    ts_investment_project,
                    ts_project_start_date,
                    ts_project_end_date,
                    ts_project_description,
                    ts_project_name,
                    ts_project_task,
                    ts_user_name,
                    ts_entry_date,
                    ts_total_hrs,
                    ts_department,
                    ts_department_code,
                    ts_project_code,
                    ts_input_file_name,
                    project_id,
                    resource_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (ts_project_name, ts_user_name, ts_entry_date) DO UPDATE SET
                    ts_capitalization_project = EXCLUDED.ts_capitalization_project,
                    ts_investment_project = EXCLUDED.ts_investment_project,
                    ts_project_start_date = EXCLUDED.ts_project_start_date,
                    ts_project_end_date = EXCLUDED.ts_project_end_date,
                    ts_project_description = EXCLUDED.ts_project_description,
                    ts_total_hrs = EXCLUDED.ts_total_hrs,
                    ts_department = EXCLUDED.ts_department,
                    ts_department_code = EXCLUDED.ts_department_code,
                    ts_project_code = EXCLUDED.ts_project_code,
                    ts_input_file_name = EXCLUDED.ts_input_file_name,
                    project_id = EXCLUDED.project_id,
                    resource_id = EXCLUDED.resource_id
            """, (
                row.get('ts_capitalization_project'),
                row.get('ts_investment_project'),
                row.get('ts_project_start_date'),
                row.get('ts_project_end_date'),
                row.get('ts_project_description'),
                row.get('ts_project_name'),
                row.get('ts_project_task'),
                row.get('ts_user_name'),
                row.get('ts_entry_date'),
                row.get('ts_total_hrs'),
                row.get('ts_department'),
                row.get('ts_department_code'),
                row.get('ts_project_code'),
                row.get('ts_input_file_name'),
                project_id,
                resource_id
            ))
            inserted_rows += 1

        #print("Rows accepted for upsert (with all date fields as string):")
        #for r in accepted_rows:
        #    print(r)

        # Print the first few values of ts_entry_date for debug
        #print("First 10 ts_entry_date values after parsing:", df['ts_entry_date'].head(10).tolist())

        #print(f"Rows inserted/updated: {inserted_rows}")

        conn.commit()
        cursor.close()
        return {"message": "Timesheet data imported successfully"}

    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)

@allocation_actual_router.get('/allocations_actual')
async def get_allocations_actual(
    resource_id: int = None,
    project_id: int = None,
    strategic_portfolio: str = None,
    product_line: str = None,
    manager_email: str = None,
    ts_start_date: str = None,
    ts_end_date: str = None
):
    """
    Fetches allocations_actual based on dynamic query parameters, with optional date range filtering.

    Args:
        resource_id (int): Filter by resource_id.
        project_id (int): Filter by project_id.
        strategic_portfolio (str): Filter by strategic_portfolio.
        product_line (str): Filter by product_line.
        manager_email (str): Filter by manager_email.
        ts_start_date (str): The start date for filtering (default: '01-JAN' of the current year).
        ts_end_date (str): The end date for filtering (default: '31-DEC' of the current year).

    Returns:
        JSONResponse: A response containing the filtered data.
    """
    try:
        # Default date range to the current year if not provided
        current_year = datetime.now().year
        ts_start_date = ts_start_date or f"{current_year}-01-01"
        ts_end_date = ts_end_date or f"{current_year}-12-31"

        # Establish a database connection
        conn = get_pg_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=DictCursor)

        # Build the WHERE clause dynamically based on query parameters
        filters = []
        params = []

        if resource_id is not None:
            filters.append("c.resource_id = %s")
            params.append(int(resource_id))
        if project_id is not None:
            filters.append("b.project_id = %s")
            params.append(int(project_id))
        if strategic_portfolio is not None:
            filters.append("b.strategic_portfolio = %s")
            params.append(strategic_portfolio)
        if product_line is not None:
            filters.append("b.product_line = %s")
            params.append(product_line)
        if manager_email is not None:
            filters.append("c.manager_email = %s")
            params.append(manager_email)

        # Add the date range filter
        filters.append("a.ts_entry_date BETWEEN %s AND %s")
        params.extend([ts_start_date, ts_end_date])

        # Construct the SQL query
        where_clause = " AND ".join(filters) if filters else "1=1"
        query = f"""
            SELECT
                a.ts_project_name AS project_name,
                a.ts_project_description AS project_description,
                a.ts_project_task AS project_task,
                a.ts_user_name AS colleague_name,
                a.ts_entry_date AS entry_date,
                a.ts_total_hrs AS total_hrs,
                a.ts_department AS department,
                a.ts_department_code AS department_code,
                a.ts_project_code AS project_code,
                a.ts_input_file_name AS input_file_name,
                b.project_id AS project_id,
                b.project_name AS project_name,
                b.strategic_portfolio AS strategic_portfolio,
                b.product_line AS product_line,
                c.resource_id AS resource_id,
                c.resource_name AS colleague_name,
                c.resource_email AS colleague_email,
                c.manager_name AS manager_name
            FROM
                pmo.timesheet_entry a
                LEFT JOIN pmo.projects b ON a.ts_project_name = b.timesheet_project_name
                LEFT JOIN pmo.resources c ON a.ts_user_name = c.timesheet_resource_name
            WHERE {where_clause}
            ORDER BY a.ts_project_name, a.ts_entry_date
        """

        cursor.execute(query, params)
        data = cursor.fetchall()

        # Convert rows to a list of dictionaries
        data = [dict(row) for row in data]

        # Convert date and Decimal objects to JSON-serializable types
        data = convert_decimal_to_float(data)

        cursor.close()
        return JSONResponse(content=data, status_code=200)

    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)

@allocation_actual_router.get('/allocation_actual_by_interval')
async def allocation_actual_by_interval(
    resource_id: int,
    start_date: str,
    end_date: str,
    interval: str = 'Weekly'
):
    """
    Fetch actual allocation data grouped by the specified interval (Weekly or Monthly).

    Args:
        resource_id (int): The ID of the resource.
        start_date (str): The start date for filtering.
        end_date (str): The end date for filtering.
        interval (str): The interval for grouping ('Weekly' or 'Monthly').

    Returns:
        JSONResponse: A response containing the grouped actual allocation data.
    """
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}, status_code=500)

    try:
        cursor = conn.cursor(cursor_factory=DictCursor)

        # Fetch actual allocation data using the SQL from /allocations_actual
        cursor.execute("""
            SELECT
                p.project_id,
                p.project_name,
                DATE(te.entry_date) AS entry_date,
                SUM(te.total_hrs) AS actual_allocation,
                SUM(te.total_hrs) * r.blended_rate AS actual_allocation_cost
            FROM pmo.timesheet_entry te
            JOIN pmo.projects p ON te.project_name = p.timesheet_project_name
            JOIN pmo.resources r ON te.user_name = r.timesheet_resource_name
            WHERE te.entry_date BETWEEN %s AND %s
            AND r.resource_id = %s
            GROUP BY p.project_id, p.project_name, DATE(te.entry_date), r.blended_rate
        """, (start_date, end_date, resource_id))
        actual_data = cursor.fetchall()

        # Convert actual data to a list of dictionaries
        actual_data = [dict(row) for row in actual_data]

        # Initialize response structure
        response = []
        cumulative = {
            "actual_hours": 0.0,
            "actual_cost": 0.0
        }

        # Generate weekly intervals with adjusted logic
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d')
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d')

        intervals = []
        current_start = start_date_obj
        while current_start <= end_date_obj:
            if current_start.weekday() == 0:  # Monday
                week_start = current_start
            else:
                week_start = current_start  # Start from the given weekday

            if current_start + timedelta(days=(4 - current_start.weekday())) <= end_date_obj:
                week_end = current_start + timedelta(days=(4 - current_start.weekday()))  # Friday of the same week
            else:
                week_end = end_date_obj  # End at the given end_date if it's not Friday

            intervals.append((week_start, week_end))
            current_start = week_end + timedelta(days=1)

        # Process data by interval
        for week_start, week_end in intervals:
            interval_key = f"{week_start.strftime('%Y-%m-%d')} to {week_end.strftime('%Y-%m-%d')}"
            interval_data = {
                "start_date": week_start.strftime('%Y-%m-%d'),
                "end_date": week_end.strftime('%Y-%m-%d'),
                "actual_allocation_hours": 0.0,
                "cumulative_actual_hours": 0.0,
                "actual_allocation_cost": 0.0,
                "cumulative_actual_cost": 0.0,
                "project_details": {}
            }

            # Aggregate actual allocation data
            for record in actual_data:
                entry_date = record["entry_date"]
                if isinstance(entry_date, datetime):
                    entry_date = entry_date.date()
                elif isinstance(entry_date, str):
                    entry_date = datetime.strptime(entry_date, '%Y-%m-%d').date()

                if week_start.date() <= entry_date <= week_end.date():
                    interval_data["actual_allocation_hours"] += float(record.get("actual_allocation", 0))
                    interval_data["actual_allocation_cost"] += float(record.get("actual_allocation_cost", 0))

                    # Update project details
                    project_id = record["project_id"]
                    if project_id not in interval_data["project_details"]:
                        interval_data["project_details"][project_id] = {
                            "project_name": record.get("project_name", ""),
                            "project_actual_allocation_hours": 0.0
                        }
                    interval_data["project_details"][project_id]["project_actual_allocation_hours"] += float(record.get("actual_allocation", 0))

            # Update cumulative values
            cumulative["actual_hours"] += interval_data["actual_allocation_hours"]
            cumulative["actual_cost"] += interval_data["actual_allocation_cost"]

            interval_data["cumulative_actual_hours"] = cumulative["actual_hours"]
            interval_data["cumulative_actual_cost"] = cumulative["actual_cost"]

            response.append(interval_data)

        return JSONResponse(content=response, status_code=200)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        if conn:
            release_pg_connection(conn)

    # --- Acceptable formats for ts_entry_start_date and ts_entry_end_date ---
    # The safest formats are: 'YYYY-MM-DD' (e.g., '2025-03-01'), 'DD-MMM-YYYY' (e.g., '01-Mar-2025'), or 'MM/DD/YYYY'
    # The code uses pd.to_datetime() which is flexible, but 'YYYY-MM-DD' is always safe.

    # Example: ts_entry_start_date='2025-03-01', ts_entry_end_date='2025-03-10'

@allocation_actual_router.post('/timesheet_entry_by_interval')
async def insert_timesheet_entry_by_interval(
    request: Request,
    project_id: int = Form(None),
    resource_id: int = Form(None),
    ts_entry_date_start: str = Form(None),
    ts_entry_date_end: str = Form(None)
):
    """
    Insert/update weekly and monthly timesheet hours into pmo.timesheet_entry_by_interval
    for the given project_id, resource_id, and date range.
    If any filter parameter is omitted, that filter is ignored.
    """
    # Extract missing form parameters if needed
    if project_id is None or resource_id is None or ts_entry_date_start is None or ts_entry_date_end is None:
        form = await request.form()
        if project_id is None and form.get("project_id") is not None:
            project_id = int(form.get("project_id"))
        if resource_id is None and form.get("resource_id") is not None:
            resource_id = int(form.get("resource_id"))
        if ts_entry_date_start is None:
            ts_entry_date_start = form.get("ts_entry_date_start")
        if ts_entry_date_end is None:
            ts_entry_date_end = form.get("ts_entry_date_end")

    try:
        conn = get_pg_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor()

        # Build dynamic SQL and params
        sql = """
            SELECT ts_entry_date, ts_total_hrs, project_id, resource_id
            FROM pmo.timesheet_entry
            WHERE 1=1
        """
        params = []

        if project_id is not None:
            sql += " AND project_id = %s"
            params.append(project_id)

        if resource_id is not None:
            sql += " AND resource_id = %s"
            params.append(resource_id)

        if ts_entry_date_start is not None and ts_entry_date_end is not None:
            sql += " AND ts_entry_date BETWEEN %s AND %s"
            params.extend([ts_entry_date_start, ts_entry_date_end])
        elif ts_entry_date_start is not None:
            sql += " AND ts_entry_date >= %s"
            params.append(ts_entry_date_start)
        elif ts_entry_date_end is not None:
            sql += " AND ts_entry_date <= %s"
            params.append(ts_entry_date_end)

        sql += " ORDER BY ts_entry_date"

        cursor.execute(sql, tuple(params))
        rows = cursor.fetchall()

        if not rows:
            return JSONResponse({"message": "No timesheet data found for the given parameters."}, status_code=200)

        # Build DataFrame
        df = pd.DataFrame(rows, columns=['ts_entry_date', 'ts_total_hrs', 'project_id', 'resource_id'])
        df['ts_entry_date'] = pd.to_datetime(df['ts_entry_date'])

        # Weekly aggregation (Monday to Sunday)
        df['start_date'] = df['ts_entry_date'].dt.to_period('W').apply(lambda r: r.start_time.date())
        df['end_date'] = df['ts_entry_date'].dt.to_period('W').apply(lambda r: r.end_time.date())
        weekly = df.groupby(['project_id', 'resource_id', 'start_date', 'end_date'], as_index=False)['ts_total_hrs'].sum()
        weekly['interval_type'] = 'Weekly'
        weekly['month_year'] = None

        # Monthly aggregation
        df['month_year'] = df['ts_entry_date'].dt.strftime('%Y-%m')
        monthly = df.groupby(['project_id', 'resource_id', 'month_year'], as_index=False)['ts_total_hrs'].sum()
        monthly['interval_type'] = 'Monthly'
        monthly['start_date'] = None
        monthly['end_date'] = None

        # Prepare records for insert/update
        weekly_records = [
            (
                row['project_id'],
                row['resource_id'],
                'Weekly',
                str(row['start_date']),
                str(row['end_date']),
                None,
                float(row['ts_total_hrs'])
            )
            for _, row in weekly.iterrows()
        ]
        monthly_records = [
            (
                row['project_id'],
                row['resource_id'],
                'Monthly',
                None,
                None,
                row['month_year'],
                float(row['ts_total_hrs'])
            )
            for _, row in monthly.iterrows()
        ]

        # Insert or update
        for rec in weekly_records + monthly_records:
            cursor.execute("""
                INSERT INTO pmo.timesheet_entry_by_interval
                (project_id, resource_id, interval_type, week_start, week_end, month_year, timesheet_hours)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT 
                    (project_id, resource_id, interval_type, week_start, week_end)
                    WHERE interval_type = 'Weekly'
                DO UPDATE SET timesheet_hours = EXCLUDED.timesheet_hours;
            """, rec) if rec[2] == 'Weekly' else cursor.execute("""
                INSERT INTO pmo.timesheet_entry_by_interval
                (project_id, resource_id, interval_type, week_start, week_end, month_year, timesheet_hours)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT 
                    (project_id, resource_id, interval_type, month_year)
                    WHERE interval_type = 'Monthly'
                DO UPDATE SET timesheet_hours = EXCLUDED.timesheet_hours;
            """, rec)

        conn.commit()
        cursor.close()

        return JSONResponse({"message": "Timesheet entry by interval inserted/updated successfully."}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in interval aggregation: {str(e)}")
    finally:
        if 'conn' in locals() and conn:
            release_pg_connection(conn)

@allocation_actual_router.get('/timesheet/{resource_id}')
async def timesheet_by_resource_id(
    resource_id: int,
    project_id: int = None,
    ts_start_date: str = None,
    ts_end_date: str = None
):
    """
    Fetch timesheet records for a specific resource from the pmo.timesheet table.
    
    Args:
        resource_id (int): The ID of the resource (path parameter).
        project_id (int): Optional filter by project_id (query parameter).
        ts_start_date (str): Optional filter by start date >= this date (YYYY-MM-DD).
        ts_end_date (str): Optional filter by end date <= this date (YYYY-MM-DD).
    
    Returns:
        JSONResponse: A response containing the timesheet records.
    """
    conn = None
    try:
        # Establish database connection
        conn = get_pg_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        cursor = conn.cursor(cursor_factory=DictCursor)
        
        # Build dynamic SQL query with filters
        query = """
            SELECT 
                resource_id,
                resource_name,
                resource_email_id,
                project_id,
                project_name,
                ts_start_date,
                ts_end_date,
                weekly_project_hrs,
                ts_added_updated_date
            FROM pmo.timesheet
            WHERE resource_id = %s
        """
        params = [resource_id]
        
        # Add optional filters
        if project_id is not None:
            query += " AND project_id = %s"
            params.append(project_id)
        
        if ts_start_date is not None:
            query += " AND ts_start_date >= %s"
            params.append(ts_start_date)
        
        if ts_end_date is not None:
            query += " AND ts_end_date <= %s"
            params.append(ts_end_date)
        
        query += " ORDER BY ts_start_date DESC, project_name"
        
        cursor.execute(query, params)
        data = cursor.fetchall()
        
        # Convert rows to list of dictionaries
        data = [dict(row) for row in data]
        
        # Convert date and Decimal objects to JSON-serializable types
        data = convert_decimal_to_float(data)
        
        cursor.close()
        
        return JSONResponse(content=data, status_code=200)
        
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)

@allocation_actual_router.post('/timesheet/upsert')
async def upsert_timesheet(
    request: Request,
    resource_id: int = Form(...),
    resource_name: str = Form(...),
    resource_email_id: str = Form(...),
    project_id: int = Form(...),
    project_name: str = Form(...),
    ts_start_date: str = Form(...),
    ts_end_date: str = Form(...),
    weekly_project_hrs: float = Form(...)
):
    """
    Upsert a record into the pmo.timesheet table.
    
    Args:
        resource_id (int): The ID of the resource.
        resource_name (str): The name of the resource.
        resource_email_id (str): The email ID of the resource.
        project_id (int): The ID of the project.
        project_name (str): The name of the project.
        ts_start_date (str): The start date of the timesheet period (YYYY-MM-DD).
        ts_end_date (str): The end date of the timesheet period (YYYY-MM-DD).
        weekly_project_hrs (float): The weekly project hours.
    
    Returns:
        JSONResponse: A response indicating success or failure.
    """
    conn = None
    try:
        # Validate and parse dates
        try:
            start_date = datetime.strptime(ts_start_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(ts_end_date, '%Y-%m-%d').date()
        except ValueError as e:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid date format. Please use YYYY-MM-DD format. Error: {str(e)}"
            )
        
        # Validate weekly_project_hrs
        if weekly_project_hrs < 0:
            raise HTTPException(status_code=400, detail="Weekly project hours cannot be negative.")
        
        # Establish database connection
        conn = get_pg_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        cursor = conn.cursor()
        
        # Upsert query
        upsert_query = """
            INSERT INTO pmo.timesheet (
                resource_id,
                resource_name,
                resource_email_id,
                project_id,
                project_name,
                ts_start_date,
                ts_end_date,
                weekly_project_hrs,
                ts_added_updated_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (resource_id, project_id, ts_start_date, ts_end_date) 
            DO UPDATE SET
                resource_name = EXCLUDED.resource_name,
                resource_email_id = EXCLUDED.resource_email_id,
                project_name = EXCLUDED.project_name,
                weekly_project_hrs = EXCLUDED.weekly_project_hrs,
                ts_added_updated_date = NOW()
        """
        
        cursor.execute(
            upsert_query,
            (
                resource_id,
                resource_name,
                resource_email_id,
                project_id,
                project_name,
                start_date,
                end_date,
                weekly_project_hrs
            )
        )
        
        conn.commit()
        cursor.close()
        
        return JSONResponse(
            content={"message": "Timesheet record upserted successfully."},
            status_code=200
        )
        
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except HTTPException:
        # Re-raise HTTPException as-is
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)