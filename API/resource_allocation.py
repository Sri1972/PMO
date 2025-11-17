from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from db_utils_pg import get_pg_connection, release_pg_connection
import psycopg2
from psycopg2.extras import DictCursor
from datetime import datetime, timedelta
from decimal import Decimal
import json
from typing import List
from utils import convert_decimal_to_float  # Import the utility function

allocation_router = APIRouter()

######################################################################
#      ALLOCATIONS Related Operations
######################################################################

# Retrieve all projects with resource allocations
@allocation_router.get('/allocations')
def get_allocations():
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}, status_code=500)
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("""
            SELECT ra.allocation_id, ra.project_id, ra.resource_id, DATE(ra.allocation_start_date) AS allocation_start_date, DATE(ra.allocation_end_date) AS allocation_end_date, ra.allocation_pct, ra.allocation_hrs_per_week, r.resource_name, r.resource_email, r.resource_type, r.resource_role, r.blended_rate, r.strategic_portfolio AS resource_strategic_portfolio, p.project_name, p.strategic_portfolio AS project_strategic_portfolio, DATE(p.start_date_est) AS start_date_est, DATE(p.end_date_est) AS end_date_est
            FROM pmo.resource_allocation ra
            JOIN pmo.resources r ON ra.resource_id = r.resource_id
            JOIN pmo.projects p ON ra.project_id = p.project_id
        """)
        allocations = cursor.fetchall()

        # Retrieve time off data
        cursor.execute("""
            SELECT resource_id, DATE(timeoff_start_date) AS timeoff_start_date, DATE(timeoff_end_date) AS timeoff_end_date
            FROM pmo.timeoff
        """)
        timeoffs = cursor.fetchall()
        cursor.close()
        conn.close()

        if not allocations:
            return JSONResponse(content=[], status_code=200)

        # Convert to list of dictionaries
        allocations = [dict(allocation) for allocation in allocations]

        # Format dates to remove timestamps and calculate number_of_hours
        for allocation in allocations:
            if allocation['start_date_est']:
                allocation['start_date_est'] = allocation['start_date_est'].strftime('%Y-%m-%d')
            if allocation['end_date_est']:
                allocation['end_date_est'] = allocation['end_date_est'].strftime('%Y-%m-%d')
            if allocation['allocation_start_date']:
                allocation['allocation_start_date'] = allocation['allocation_start_date'].strftime('%Y-%m-%d')
            if allocation['allocation_end_date']:
                allocation['allocation_end_date'] = allocation['allocation_end_date'].strftime('%Y-%m-%d')

            # Calculate number_of_hours
            start_date = datetime.strptime(allocation['allocation_start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(allocation['allocation_end_date'], '%Y-%m-%d').date()
            total_days = (end_date - start_date).days + 1  # Include end date

            # Calculate total weekdays
            total_weekdays = sum(1 for day in (start_date + timedelta(days=i) for i in range(total_days)) if day.weekday() < 5)
            hours_per_day = 8  # Assuming 8 working hours_per_day
            total_hours = total_weekdays * hours_per_day

            # Calculate time off days
            time_off_days = 0
            for timeoff in timeoffs:
                if timeoff['resource_id'] == allocation['resource_id']:
                    timeoff_start = timeoff['timeoff_start_date']
                    timeoff_end = timeoff['timeoff_end_date']
                    if timeoff_start <= end_date and timeoff_end >= start_date:
                        overlap_start = max(start_date, timeoff_start)
                        overlap_end = min(end_date, timeoff_end)
                        time_off_days += sum(1 for day in (overlap_start + timedelta(days=i) for i in range((overlap_end - overlap_start).days + 1)) if day.weekday() < 5)

            total_hours -= Decimal(str(time_off_days)) * Decimal(str(hours_per_day))

            # Calculate final hours based on allocation_pct or allocation_hrs_per_week
            if allocation['allocation_hrs_per_week']:
                total_weeks = Decimal(str(total_days)) / Decimal('7')
                allocation_hrs_per_week = Decimal(str(allocation['allocation_hrs_per_week']))
                final_hours = (total_weeks * allocation_hrs_per_week).quantize(Decimal('0.1'))
            else:
                allocation_pct = Decimal(str(allocation['allocation_pct'] or 0)) / Decimal('100')
                final_hours = (Decimal(str(total_hours)) * allocation_pct).quantize(Decimal('0.1'))

            # Calculate resource cost and round to two decimals
            blended_rate = Decimal(str(allocation['blended_rate'] or 0))

            allocation['resource_hours_planned'] = final_hours
            allocation['resource_cost_planned'] = (final_hours * blended_rate).quantize(Decimal('0.01'))

        # Convert Decimal objects to float
        allocations = convert_decimal_to_float(allocations)  # Convert Decimal to float
        return JSONResponse(content=allocations)
    except psycopg2.Error as e:
        print(f"Error during retrieval of allocations: {e}")
        return JSONResponse({"error": str(e)}, status_code=400)
    finally:
        if conn:
            release_pg_connection(conn)

# Retrieve allocations by project IDs
@allocation_router.get('/allocations/project')
def get_allocations_by_project(project_ids: List[int] = Query(...)):
    """
    Retrieve allocations for one or more projects.
    """
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}, status_code=500)
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        
        # Fetch planned allocations
        cursor.execute("""
            SELECT ra.allocation_id, ra.project_id, ra.resource_id, DATE(ra.allocation_start_date) AS allocation_start_date, DATE(ra.allocation_end_date) AS allocation_end_date, ra.allocation_pct, ra.allocation_hrs_per_week, r.resource_name, r.resource_email, r.resource_type, r.resource_role, r.blended_rate, r.strategic_portfolio AS resource_strategic_portfolio, p.project_name, p.strategic_portfolio AS project_strategic_portfolio, p.product_line AS project_product_line, DATE(p.start_date_est) AS start_date_est, DATE(p.end_date_est) AS end_date_est
            FROM pmo.resource_allocation ra
            JOIN pmo.resources r ON ra.resource_id = r.resource_id
            JOIN pmo.projects p ON ra.project_id = p.project_id
            WHERE ra.project_id = ANY(%s)
        """, (project_ids,))
        allocations = cursor.fetchall()

        # Fetch actual hours data
        cursor.execute("""
            SELECT p.project_id, r.resource_id, MIN(DATE(ts_entry_date)) AS timesheet_start_date, MAX(DATE(ts_entry_date)) AS timesheet_end_date, SUM(ts_total_hrs) AS actual_hours, r.blended_rate
            FROM pmo.timesheet_entry te
            JOIN pmo.projects p ON te.ts_project_name = p.timesheet_project_name
            JOIN pmo.resources r ON te.ts_user_name = r.timesheet_resource_name
            WHERE p.project_id = ANY(%s)
            GROUP BY p.project_id, r.resource_id
        """, (project_ids,))
        actual_hours_data = cursor.fetchall()

        cursor.close()
        conn.close()

        if not allocations and not actual_hours_data:
            return JSONResponse(content={}, status_code=200)

        # Convert allocations to a list of dictionaries
        allocations = [dict(allocation) for allocation in allocations]

        # Map actual hours data by resource_id for easy lookup
        actual_hours_map = {row['resource_id']: row for row in actual_hours_data}

        # Format dates and calculate additional fields
        for allocation in allocations:
            if allocation['start_date_est']:
                allocation['start_date_est'] = allocation['start_date_est'].strftime('%Y-%m-%d')
            if allocation['end_date_est']:
                allocation['end_date_est'] = allocation['end_date_est'].strftime('%Y-%m-%d')
            if allocation['allocation_start_date']:
                allocation['allocation_start_date'] = allocation['allocation_start_date'].strftime('%Y-%m-%d')
            if allocation['allocation_end_date']:
                allocation['allocation_end_date'] = allocation['allocation_end_date'].strftime('%Y-%m-%d')

            # Calculate planned hours and cost
            start_date = datetime.strptime(allocation['allocation_start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(allocation['allocation_end_date'], '%Y-%m-%d').date()
            total_days = (end_date - start_date).days + 1  # Include end date

            # Calculate total weekdays
            total_weekdays = sum(1 for day in (start_date + timedelta(days=i) for i in range(total_days)) if day.weekday() < 5)
            hours_per_day = 8  # Assuming 8 working hours per day
            total_hours = total_weekdays * hours_per_day

            # Calculate planned hours based on allocation_pct or allocation_hrs_per_week
            if allocation['allocation_hrs_per_week']:
                total_weeks = Decimal(str(total_days)) / Decimal('7')
                allocation_hrs_per_week = Decimal(str(allocation['allocation_hrs_per_week']))
                final_hours = (total_weeks * allocation_hrs_per_week).quantize(Decimal('0.1'))
            else:
                allocation_pct = Decimal(str(allocation['allocation_pct'] or 0)) / Decimal('100')
                final_hours = (Decimal(str(total_hours)) * allocation_pct).quantize(Decimal('0.1'))

            # Calculate planned resource cost
            blended_rate = Decimal(str(allocation['blended_rate'] or 0))
            resource_cost_planned = (final_hours * blended_rate).quantize(Decimal('0.01'))

            allocation['resource_hours_planned'] = final_hours
            allocation['resource_cost_planned'] = resource_cost_planned

            # Add actual hours and cost if available
            actual_hours_entry = actual_hours_map.get(allocation['resource_id'], {})
            actual_hours = Decimal(str(actual_hours_entry.get('actual_hours', 0) or 0))
            allocation['resource_hours_actual'] = actual_hours.quantize(Decimal('0.1'))
            allocation['resource_cost_actual'] = (actual_hours * blended_rate).quantize(Decimal('0.01')) if actual_hours_entry else Decimal('0.00')

            # Convert timesheet dates to strings
            allocation['timesheet_start_date'] = actual_hours_entry.get('timesheet_start_date', None)
            allocation['timesheet_end_date'] = actual_hours_entry.get('timesheet_end_date', None)
            if allocation['timesheet_start_date']:
                allocation['timesheet_start_date'] = allocation['timesheet_start_date'].strftime('%Y-%m-%d')
            if allocation['timesheet_end_date']:
                allocation['timesheet_end_date'] = allocation['timesheet_end_date'].strftime('%Y-%m-%d')

        # Convert Decimal objects to float
        allocations = convert_decimal_to_float(allocations)  # Convert Decimal to float
        if not allocations:
            return JSONResponse(content=[], status_code=200)
        return JSONResponse(content=allocations)
    
    except psycopg2.Error as e:
        print(f"Error during retrieval of allocations by project: {e}")
        return JSONResponse({"error": str(e)}, status_code=400)
    finally:
        if conn:
            release_pg_connection(conn)

@allocation_router.get('/allocations/resource/{resource_id}')
def get_allocations_by_resource(resource_id):
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}, status_code=500)
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        
        # Fetch resource allocations
        cursor.execute("""
            SELECT ra.allocation_id, ra.project_id, ra.resource_id, DATE(ra.allocation_start_date) AS allocation_start_date, DATE(ra.allocation_end_date) AS allocation_end_date, ra.allocation_pct, ra.allocation_hrs_per_week, r.resource_name, r.resource_email, r.resource_type, r.resource_role, r.blended_rate, r.strategic_portfolio AS resource_strategic_portfolio, p.project_name, p.strategic_portfolio AS project_strategic_portfolio, DATE(p.start_date_est) AS start_date_est, DATE(p.end_date_est) AS end_date_est
            FROM pmo.resource_allocation ra
            JOIN pmo.resources r ON ra.resource_id = r.resource_id
            JOIN pmo.projects p ON ra.project_id = p.project_id
            WHERE ra.resource_id = %s
        """, (resource_id,))
        allocations = cursor.fetchall()

        # Fetch time off data
        cursor.execute("""
            SELECT resource_id, DATE(timeoff_start_date) AS timeoff_start_date, DATE(timeoff_end_date) AS timeoff_end_date
            FROM pmo.timeoff
        """)
        timeoffs = cursor.fetchall()

        # Fetch actual hours data
        cursor.execute("""
            SELECT p.project_id, r.resource_id, MIN(DATE(ts_entry_date)) AS timesheet_start_date, MAX(DATE(ts_entry_date)) AS timesheet_end_date, SUM(ts_total_hrs) AS actual_hours, r.blended_rate
            FROM pmo.timesheet_entry te
            JOIN pmo.resources r ON te.ts_user_name = r.timesheet_resource_name
            JOIN pmo.projects p ON te.ts_project_name = p.timesheet_project_name
            WHERE r.resource_id = %s
            GROUP BY r.resource_id, p.project_id
        """, (resource_id,))
        actual_hours_data = cursor.fetchall()

        cursor.close()
        conn.close()

        if not allocations and not actual_hours_data:
            return JSONResponse(content=[], status_code=200)

        # Convert allocations to a list of dictionaries
        allocations = [dict(allocation) for allocation in allocations]

        # Map actual hours data by project_id for easy lookup
        actual_hours_map = {row['project_id']: row for row in actual_hours_data}

        # Format dates and calculate number_of_hours
        for allocation in allocations:
            if allocation['start_date_est']:
                allocation['start_date_est'] = allocation['start_date_est'].strftime('%Y-%m-%d')
            if allocation['end_date_est']:
                allocation['end_date_est'] = allocation['end_date_est'].strftime('%Y-%m-%d')
            if allocation['allocation_start_date']:
                allocation['allocation_start_date'] = allocation['allocation_start_date'].strftime('%Y-%m-%d')
            if allocation['allocation_end_date']:
                allocation['allocation_end_date'] = allocation['allocation_end_date'].strftime('%Y-%m-%d')

            # Calculate number_of_hours
            start_date = datetime.strptime(allocation['allocation_start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(allocation['allocation_end_date'], '%Y-%m-%d').date()
            total_days = (end_date - start_date).days + 1  # Include end date

            # Calculate total weekdays
            total_weekdays = sum(1 for day in (start_date + timedelta(days=i) for i in range(total_days)) if day.weekday() < 5)
            hours_per_day = 8  # Assuming 8 working hours_per_day
            total_hours = total_weekdays * hours_per_day

            # Calculate time off days
            time_off_days = 0
            for timeoff in timeoffs:
                if timeoff['resource_id'] == allocation['resource_id']:
                    timeoff_start = timeoff['timeoff_start_date']
                    timeoff_end = timeoff['timeoff_end_date']
                    if timeoff_start <= end_date and timeoff_end >= start_date:
                        overlap_start = max(start_date, timeoff_start)
                        overlap_end = min(end_date, timeoff_end)
                        time_off_days += sum(1 for day in (overlap_start + timedelta(days=i) for i in range((overlap_end - overlap_start).days + 1)) if day.weekday() < 5)

            total_hours -= Decimal(str(time_off_days)) * Decimal(str(hours_per_day))

            # Calculate final hours based on allocation_pct or allocation_hrs_per_week
            if allocation['allocation_hrs_per_week']:
                total_weeks = Decimal(str(total_days)) / Decimal('7')
                allocation_hrs_per_week = Decimal(str(allocation['allocation_hrs_per_week']))
                final_hours = (total_weeks * allocation_hrs_per_week).quantize(Decimal('0.1'))
            else:
                allocation_pct = Decimal(str(allocation['allocation_pct'] or 0)) / Decimal('100')
                final_hours = (Decimal(str(total_hours)) * allocation_pct).quantize(Decimal('0.1'))

            blended_rate = Decimal(str(allocation['blended_rate'] or 0))
            allocation['resource_hours_planned'] = final_hours
            allocation['resource_cost_planned'] = (final_hours * blended_rate).quantize(Decimal('0.01'))

            # Add actual hours data if available
            actual_hours_entry = actual_hours_map.get(allocation['project_id'], {})
            actual_hours = Decimal(str(actual_hours_entry.get('actual_hours', 0) or 0))
            allocation['resource_hours_actual'] = actual_hours.quantize(Decimal('0.1'))
            allocation['timesheet_start_date'] = actual_hours_entry.get('timesheet_start_date', None)
            allocation['timesheet_end_date'] = actual_hours_entry.get('timesheet_end_date', None)

            allocation['resource_cost_actual'] = (actual_hours * blended_rate).quantize(Decimal('0.01')) if actual_hours else Decimal('0.00')

            # Convert timesheet dates to strings
            if allocation['timesheet_start_date']:
                allocation['timesheet_start_date'] = allocation['timesheet_start_date'].strftime('%Y-%m-%d')
            if allocation['timesheet_end_date']:
                allocation['timesheet_end_date'] = allocation['timesheet_end_date'].strftime('%Y-%m-%d')

        # Convert Decimal objects to float
        allocations = convert_decimal_to_float(allocations)  # Convert Decimal to float

        return JSONResponse(content=allocations)
    except psycopg2.Error as e:
        print(f"Error during retrieval of allocations by resource: {e}")
        return JSONResponse({"error": str(e)}, status_code=400)
    finally:
        if conn:
            release_pg_connection(conn)

# Retrieve project summary
@allocation_router.get('/allocations/project_summary')
def get_allocation_project_summary(project_ids: List[int] = Query(...)):
    """
    Retrieve project summaries for one or more projects.
    """
    try:
        # Call the existing get_allocations_by_project method with the list of project_ids
        allocations_response = get_allocations_by_project(project_ids=project_ids)

        if allocations_response.status_code != 200:
            return allocations_response

        allocations = json.loads(allocations_response.body.decode("utf-8"))

        if not allocations:
            # Handle case where no data exists for the projects
            return JSONResponse(content={}, status_code=200)

        summaries = {}
        for project_id in project_ids:
            project_allocations = [a for a in allocations if a['project_id'] == project_id]
            if not project_allocations:
                continue

            total_resource_hours_planned = sum(float(a.get('resource_hours_planned', 0)) for a in project_allocations)
            total_resource_cost_planned = sum(float(a.get('resource_cost_planned', 0)) for a in project_allocations)
            total_resource_hours_actual = sum(float(a.get('resource_hours_actual', 0)) for a in project_allocations)
            total_resource_cost_actual = sum(float(a.get('resource_cost_actual', 0)) for a in project_allocations)

            summaries[project_id] = {
                "project_id": project_id,
                "project_name": project_allocations[0].get('project_name', ''),
                "strategic_portfolio": project_allocations[0].get('project_strategic_portfolio', ''),
                "total_resource_hours_planned": round(total_resource_hours_planned, 1),
                "total_resource_cost_planned": round(total_resource_cost_planned, 2),
                "total_resource_hours_actual": round(total_resource_hours_actual, 1),
                "total_resource_cost_actual": round(total_resource_cost_actual, 2)
            }

        return JSONResponse(content=summaries, status_code=200)
    except Exception as e:
        print(f"Error in get_allocation_project_summary: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

# Get summary based on resource_role
@allocation_router.get('/allocations/resource_role_summary')
def get_allocation_resource_role_summary(project_ids: List[int] = Query(...)):
    """
    Retrieve resource role summaries for one or more projects, grouped by project_id.
    """
    try:
        # Call the existing get_allocations_by_project method with the list of project_ids
        allocations_response = get_allocations_by_project(project_ids=project_ids)
        if allocations_response.status_code != 200:
            print(f"Error: get_allocations_by_project failed with status {allocations_response.status_code}")
            return allocations_response

        allocations = json.loads(allocations_response.body.decode("utf-8"))

        if not allocations:
            print(f"Debug: No allocations found for project_ids: {project_ids}")
            return JSONResponse(content={}, status_code=200)

        # Debugging: Log allocations
        #print(f"Debug: Allocations retrieved for project_ids {project_ids}: {allocations}")

        # Group resource role summaries by project_id
        grouped_summary = {}
        for allocation in allocations:
            project_id = allocation.get('project_id')
            resource_role = allocation.get('resource_role')

            if not project_id or not resource_role:
                print(f"Debug: Allocation missing project_id or resource_role: {allocation}")
                continue

            if project_id not in grouped_summary:
                grouped_summary[project_id] = {}

            if resource_role not in grouped_summary[project_id]:
                grouped_summary[project_id][resource_role] = {
                    'total_resource_hours_planned': 0,
                    'total_resource_cost_planned': Decimal(0),
                    'total_resource_hours_actual': 0,
                    'total_resource_cost_actual': Decimal(0),
                    'resources_details': []  # Initialize resources_details as an empty array
                }

            # Debugging: Log the allocation being processed
            #print(f"Debug: Processing allocation for project_id '{project_id}', resource_role '{resource_role}': {allocation}")

            # Ensure values are properly converted and rounded
            try:
                hours_planned = Decimal(str(allocation.get('resource_hours_planned', 0) or 0)).quantize(Decimal('0.1'))
                cost_planned = Decimal(str(allocation.get('resource_cost_planned', 0) or 0)).quantize(Decimal('0.01'))
                hours_actual = Decimal(str(allocation.get('resource_hours_actual', 0) or 0)).quantize(Decimal('0.1'))
                cost_actual = Decimal(str(allocation.get('resource_cost_actual', 0) or 0)).quantize(Decimal('0.01'))
            except Exception as e:
                print(f"Error converting or rounding values for allocation: {allocation}. Error: {e}")
                continue

            # Debugging: Log rounded values
            #print(f"Rounded Values - Hours Planned: {hours_planned}, Cost Planned: {cost_planned}, Hours Actual: {hours_actual}, Cost Actual: {cost_actual}")

            grouped_summary[project_id][resource_role]['total_resource_hours_planned'] += hours_planned
            grouped_summary[project_id][resource_role]['total_resource_cost_planned'] += cost_planned
            grouped_summary[project_id][resource_role]['total_resource_hours_actual'] += hours_actual
            grouped_summary[project_id][resource_role]['total_resource_cost_actual'] += cost_actual

            # Debugging: Log aggregated totals before final rounding
            #print(f"Aggregated Totals Before Rounding - total_resource_hours_planned: {grouped_summary[project_id][resource_role]['total_resource_hours_planned']}")

            # Add resource details to resources_details array
            resource_detail = {
                'resource_id': allocation.get('resource_id', ''),
                'resource_name': allocation.get('resource_name', ''),
                'resource_email': allocation.get('resource_email', ''),
                'resource_hours_planned': hours_planned,
                'resource_cost_planned': cost_planned,
                'resource_hours_actual': hours_actual,
                'resource_cost_actual': cost_actual
            }
            if resource_detail not in grouped_summary[project_id][resource_role]['resources_details']:
                grouped_summary[project_id][resource_role]['resources_details'].append(resource_detail)

        # Round aggregated totals to avoid floating-point precision issues
        for project_id, roles in grouped_summary.items():
            for role, summary in roles.items():
                summary['total_resource_hours_planned'] = round(summary['total_resource_hours_planned'], 1)
                summary['total_resource_cost_planned'] = round(summary['total_resource_cost_planned'], 2)
                summary['total_resource_hours_actual'] = round(summary['total_resource_hours_actual'], 1)
                summary['total_resource_cost_actual'] = round(summary['total_resource_cost_actual'], 2)

        # Convert Decimal to float for JSON serialization
        grouped_summary = {project_id: convert_decimal_to_float(summary) for project_id, summary in grouped_summary.items()}

        #print(f"Debug: Grouped resource role summary generated: {grouped_summary}")
        return JSONResponse(content=grouped_summary, status_code=200)
    except Exception as e:
        print(f"Error in get_allocation_resource_role_summary: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

# Insert record into resource_allocation table
@allocation_router.post('/allocate')
async def allocate_resource(request: Request):
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        # Correctly parse the JSON body from the request
        data = await request.json()

        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="Invalid data format. Expected a list of allocations.")

        cursor = conn.cursor()
        for allocation in data:
            # Log each allocation to ensure required keys are present
            #print(f"Processing allocation: {allocation}")
            if 'allocation_id' not in allocation:
                print(f"Missing required key in allocation: {allocation}")
                return JSONResponse(content={"error": "Missing required key in allocation"}, status_code=400)

            cursor.execute("""
                INSERT INTO pmo.resource_allocation (allocation_id, project_id, resource_id, allocation_start_date, allocation_end_date, allocation_pct, allocation_hrs_per_week)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (allocation_id) DO UPDATE SET
                    project_id = EXCLUDED.project_id,
                    resource_id = EXCLUDED.resource_id,
                    allocation_start_date = EXCLUDED.allocation_start_date,
                    allocation_end_date = EXCLUDED.allocation_end_date,
                    allocation_pct = EXCLUDED.allocation_pct,
                    allocation_hrs_per_week = EXCLUDED.allocation_hrs_per_week
            """, (
                allocation['allocation_id'],
                allocation['project_id'],
                allocation['resource_id'],
                allocation['allocation_start_date'],
                allocation['allocation_end_date'],
                allocation.get('allocation_pct', None),  # Handle missing key as None
                allocation.get('allocation_hrs_per_week', None)  # Handle missing key as None
            ))
        conn.commit()
        cursor.close()
        conn.close()
        return JSONResponse(content={"message": "Resource allocation upserted successfully"}, status_code=201)
    except psycopg2.Error as e:
        print(f"Error during allocation operation: {e}")  # Log the error during allocation
        return JSONResponse(content={"error": str(e)}, status_code=400)
    except Exception as e:
        print(f"Unexpected error: {e}")  # Log unexpected errors
        return JSONResponse(content={"error": str(e)}, status_code=400)
    finally:
        if conn:
            release_pg_connection(conn)

# Delete allocation
@allocation_router.delete('/allocations/{allocation_id}')
def delete_allocation(allocation_id):
    print(f"Received request to delete allocation ID {allocation_id}")

    if not allocation_id:
        return JSONResponse({"error": "Allocation ID is required"}), 400

    conn = get_pg_connection()
    if conn is None:
        print("Failed to connect to database")
        return JSONResponse({"error": "Database connection failed"}), 500

    try:
        print(f"Deleting allocation for Allocation ID {allocation_id}")
        cursor = conn.cursor()
        delete_query = """
            DELETE FROM pmo.resource_allocation
            WHERE allocation_id = %s
        """
        print(f"Executing query: {delete_query} with allocation_id={allocation_id}")
        cursor.execute(delete_query, (allocation_id,))
        affected_rows = cursor.rowcount
        print(f"Rows affected: {affected_rows}")
        conn.commit()
        cursor.close()
        conn.close()
        if affected_rows == 0:
            print(f"No allocation found for Allocation ID {allocation_id}")
            return JSONResponse({}), 200
        print(f"Successfully deleted allocation for Allocation ID {allocation_id}")
        return JSONResponse({"message": "Resource allocation deleted successfully"}), 200
    except psycopg2.Error as e:
        print(f"Error during deletion of allocation: {e}")
        return JSONResponse({"error": str(e)}), 400
    finally:
        if conn:
            release_pg_connection(conn)

# Get next allocation ID
@allocation_router.get('/allocations/next_allocation_id')
def get_next_allocation_id():
    """Generate a new allocation_id that does not exist in `random_resource_ids`."""
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse(content={"error": "Database connection failed"}, status_code=500)

    try:
        cursor = conn.cursor()

        cursor.execute("SELECT COALESCE(MAX(allocation_id), 0) FROM pmo.random_allocation_ids")
        max_id = cursor.fetchone()[0]

        max_id += 1

        cursor.execute("INSERT INTO pmo.random_allocation_ids (allocation_id) VALUES (%s)", (max_id,))
        conn.commit()

        return JSONResponse(content={"next_allocation_id": max_id}, status_code=200)

    except psycopg2.Error as e:
        print(f"Error generating allocation ID: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=400)

    finally:
        if cursor:
            cursor.close()
        if conn:
            release_pg_connection(conn)