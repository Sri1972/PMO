from fastapi import APIRouter, HTTPException, Request, Depends, Body
from fastapi.responses import JSONResponse
from db_utils_pg import get_pg_connection, release_pg_connection
import psycopg2
from psycopg2.extras import DictCursor
from resource_allocation import get_allocation_project_summary, get_allocation_resource_role_summary
from typing import Any
from utils import convert_decimal_to_float  # Import the utility function
import json

projects_router = APIRouter()

######################################################################
#      PROJECTS Related Operations
######################################################################

@projects_router.get('/projects')
async def get_projects(request: Request) -> JSONResponse:
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        #start_time = time.time()  # Start timing
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("""
            SELECT project_id, project_name, strategic_portfolio, product_line, project_type, project_description, vitality, strategic, aim, revenue_est_growth_pa, revenue_est_current_year, revenue_est_current_year_plus_1, revenue_est_current_year_plus_2, revenue_est_current_year_plus_3, start_date_est, end_date_est, start_date_actual, end_date_actual, current_status, rag_status, comments, added_by, added_date, updated_by, updated_date, timesheet_project_name, technology_project
            FROM pmo.projects
        """)
        projects = cursor.fetchall()
        #query_time = time.time() - start_time  # Time taken for query

        # Convert projects to a list of dictionaries
        projects = [dict(project) for project in projects]

        # Extract project IDs
        project_ids = [project['project_id'] for project in projects]

        # Fetch project summaries for all projects
        summary_response = get_allocation_project_summary(project_ids=project_ids)
        if summary_response.status_code == 200:
            project_summaries = json.loads(summary_response.body.decode("utf-8"))
        else:
            project_summaries = {}

        # Fetch resource role summaries for all projects
        role_summary_response = get_allocation_resource_role_summary(project_ids=project_ids)
        if role_summary_response.status_code == 200:
            role_summaries = json.loads(role_summary_response.body.decode("utf-8"))
        else:
            role_summaries = {}

        # Consolidate data into the projects list
        for project in projects:
            project_id = project['project_id']

            # Format dates
            if project['start_date_est']:
                project['start_date_est'] = project['start_date_est'].strftime('%Y-%m-%d')
            if project['end_date_est']:
                project['end_date_est'] = project['end_date_est'].strftime('%Y-%m-%d')
            if project['start_date_actual']:
                project['start_date_actual'] = project['start_date_actual'].strftime('%Y-%m-%d')
            if project['end_date_actual']:
                project['end_date_actual'] = project['end_date_actual'].strftime('%Y-%m-%d')

            # Add project summary data
            summary_data = project_summaries.get(str(project_id), {})
            project['project_resource_hours_planned'] = round(summary_data.get('total_resource_hours_planned', 0), 1)
            project['project_resource_cost_planned'] = round(summary_data.get('total_resource_cost_planned', 0), 2)
            project['project_resource_hours_actual'] = round(summary_data.get('total_resource_hours_actual', 0), 1)
            project['project_resource_cost_actual'] = round(summary_data.get('total_resource_cost_actual', 0), 2)

            # Add resource role summary data directly without the "role_summary" level
            project['resource_role_summary'] = role_summaries.get(str(project_id), {})

        projects = convert_decimal_to_float(projects)  # Use the utility function
        return JSONResponse(content=projects)  # Return only the projects array
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)

@projects_router.get('/projects/{project_id}')
async def get_project_by_id(project_id) -> JSONResponse:
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        #start_time = time.time()  # Start timing
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("""
            SELECT project_id, project_name, strategic_portfolio, product_line, project_type, project_description, vitality, strategic, aim, revenue_est_growth_pa, revenue_est_current_year, revenue_est_current_year_plus_1, revenue_est_current_year_plus_2, revenue_est_current_year_plus_3, start_date_est, end_date_est, start_date_actual, end_date_actual, current_status, rag_status, comments, added_by, added_date, updated_by, updated_date, timesheet_project_name, technology_project
            FROM pmo.projects
            WHERE project_id = %s
        """, (project_id,))

        projects = cursor.fetchall()
        #query_time = time.time() - start_time  # Time taken for query

        # Convert projects to a list of dictionaries
        projects = [dict(project) for project in projects]

        # Extract project IDs
        project_ids = [project['project_id'] for project in projects]

        # Fetch project summaries for all projects
        summary_response = get_allocation_project_summary(project_ids=project_ids)
        if summary_response.status_code == 200:
            project_summaries = json.loads(summary_response.body.decode("utf-8"))
        else:
            project_summaries = {}

        # Fetch resource role summaries for all projects
        role_summary_response = get_allocation_resource_role_summary(project_ids=project_ids)
        if role_summary_response.status_code == 200:
            role_summaries = json.loads(role_summary_response.body.decode("utf-8"))
        else:
            role_summaries = {}

        # Consolidate data into the projects list
        for project in projects:
            project_id = project['project_id']

            # Format dates
            if project['start_date_est']:
                project['start_date_est'] = project['start_date_est'].strftime('%Y-%m-%d')
            if project['end_date_est']:
                project['end_date_est'] = project['end_date_est'].strftime('%Y-%m-%d')
            if project['start_date_actual']:
                project['start_date_actual'] = project['start_date_actual'].strftime('%Y-%m-%d')
            if project['end_date_actual']:
                project['end_date_actual'] = project['end_date_actual'].strftime('%Y-%m-%d')

            # Add project summary data
            summary_data = project_summaries.get(str(project_id), {})
            project['project_resource_hours_planned'] = round(summary_data.get('total_resource_hours_planned', 0), 1)
            project['project_resource_cost_planned'] = round(summary_data.get('total_resource_cost_planned', 0), 2)
            project['project_resource_hours_actual'] = round(summary_data.get('total_resource_hours_actual', 0), 1)
            project['project_resource_cost_actual'] = round(summary_data.get('total_resource_cost_actual', 0), 2)

            # Add resource role summary data directly without the "role_summary" level
            project['resource_role_summary'] = role_summaries.get(str(project_id), {})

        projects = convert_decimal_to_float(projects)  # Use the utility function
        return JSONResponse(content=projects)  # Return only the projects array
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)

@projects_router.post('/projects')
async def add_or_update_project(request: Request) -> JSONResponse:
    data = await request.json()
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO pmo.projects (project_name, strategic_portfolio, product_line, project_type, project_description, vitality, strategic, aim, revenue_est_growth_pa, revenue_est_current_year, revenue_est_current_year_plus_1, revenue_est_current_year_plus_2, revenue_est_current_year_plus_3, start_date_est, end_date_est, start_date_actual, end_date_actual, current_status, rag_status, comments, added_by, added_date, updated_by, updated_date, timesheet_project_name, technology_project)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (project_name, strategic_portfolio, product_line) DO UPDATE SET
            -- project_name = EXCLUDED.project_name,
            -- strategic_portfolio = EXCLUDED.strategic_portfolio,
            -- product_line = EXCLUDED.product_line,
            project_type = EXCLUDED.project_type,
            project_description = EXCLUDED.project_description,
            vitality = EXCLUDED.vitality,
            strategic = EXCLUDED.strategic,
            aim = EXCLUDED.aim,
            revenue_est_growth_pa = EXCLUDED.revenue_est_growth_pa,
            revenue_est_current_year = EXCLUDED.revenue_est_current_year,
            revenue_est_current_year_plus_1 = EXCLUDED.revenue_est_current_year_plus_1,
            revenue_est_current_year_plus_2 = EXCLUDED.revenue_est_current_year_plus_2,
            revenue_est_current_year_plus_3 = EXCLUDED.revenue_est_current_year_plus_3,
            start_date_est = EXCLUDED.start_date_est,
            end_date_est = EXCLUDED.end_date_est,
            start_date_actual = EXCLUDED.start_date_actual,
            end_date_actual = EXCLUDED.end_date_actual,
            current_status = EXCLUDED.current_status,
            rag_status = EXCLUDED.rag_status,
            comments = EXCLUDED.comments,
            added_by = EXCLUDED.added_by,
            added_date = EXCLUDED.added_date,
            updated_by = EXCLUDED.updated_by,
            updated_date = EXCLUDED.updated_date,
            timesheet_project_name = EXCLUDED.timesheet_project_name,
            technology_project = EXCLUDED.technology_project
        """, (
            data.get('project_name'),
            data.get('strategic_portfolio'),
            data.get('product_line'),
            data.get('project_type'),
            data.get('project_description'),
            data.get('vitality'),
            data.get('strategic'),
            data.get('aim'),
            data.get('revenue_est_growth_pa') or None,
            data.get('revenue_est_current_year') or None,
            data.get('revenue_est_current_year_plus_1') or None,
            data.get('revenue_est_current_year_plus_2') or None,
            data.get('revenue_est_current_year_plus_3') or None,
            data.get('start_date_est'),
            data.get('end_date_est'),
            data.get('start_date_actual') or None,
            data.get('end_date_actual') or None,
            data.get('current_status'),
            data.get('rag_status') or None,
            data.get('comments'),
            data.get('added_by'),
            data.get('added_date') or None,
            data.get('updated_by'),
            data.get('updated_date') or None,
            data.get('timesheet_project_name') or None,
            data.get('technology_project') or None
        ))
        conn.commit()
        return JSONResponse(content={"message": "Project added or updated successfully"}, status_code=201)
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)

@projects_router.get('/projects/timelines/{project_id}')
def get_project_timelines(project_id):
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("""
            SELECT milestone, milestone_description, start_date, end_date, sequence
            FROM pmo.project_timelines
            WHERE project_id = %s
            ORDER BY sequence ASC
        """, (project_id,))
        timelines = cursor.fetchall()

        for timeline in timelines:
            if timeline['start_date']:
                timeline['start_date'] = timeline['start_date'].strftime('%Y-%m-%d')
            if timeline['end_date']:
                timeline['end_date'] = timeline['end_date'].strftime('%Y-%m-%d')

        timelines = convert_decimal_to_float(timelines)  # Use the utility function
        return JSONResponse(content=timelines, status_code=200)
    except psycopg2.Error as e:
        print(f"Error during retrieval of project timelines: {e}")
        return JSONResponse({"error": str(e)}, status_code=400)
    finally:
        if conn:
            release_pg_connection(conn)

@projects_router.post('/projects/timelines/{project_id}')
def add_or_update_project_timeline(project_id):
    data = Request.json
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)

        if 'sequence' not in data or data['sequence'] is None:
            cursor.execute("""
                SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence
                FROM pmo.project_timelines
                WHERE project_id = %s
            """, (project_id,))
            next_sequence = cursor.fetchone()['next_sequence']
            data['sequence'] = next_sequence

        cursor.execute("""
            INSERT INTO pmo.project_timelines (project_id, milestone, milestone_description, start_date, end_date, sequence)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (project_id, milestone) DO UPDATE SET
                milestone_description = EXCLUDED.milestone_description,
                start_date = EXCLUDED.start_date,
                end_date = EXCLUDED.end_date,
                sequence = EXCLUDED.sequence
        """, (
            project_id,
            data.get('milestone'),
            data.get('milestone_description'),
            data.get('start_date'),
            data.get('end_date'),
            data['sequence']
        ))
        conn.commit()
        return JSONResponse(content={"message": "Project timeline added or updated successfully"}), 201
    except psycopg2.Error as e:
        print(f"Error during insert or update operation for project timelines: {e}")
        return JSONResponse({"error": str(e)}), 400
    finally:
        if conn:
            release_pg_connection(conn)

@projects_router.post('/projects//timelines/reorder/{project_id}')
def reorder_project_timelines(project_id):
    data = Request.json
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        for timeline in data:
            cursor.execute("""
                UPDATE pmo.project_timelines
                SET sequence = %s
                WHERE project_id = %s AND milestone = %s
            """, (timeline['sequence'], project_id, timeline['milestone']))
        conn.commit()
        return JSONResponse(content={"message": "Timelines reordered successfully"}), 200
    except psycopg2.Error as e:
        print(f"Error during reordering of project timelines: {e}")
        return JSONResponse({"error": str(e)}), 400
    finally:
        if conn:
            release_pg_connection(conn)

@projects_router.delete('/projects/timelines/{project_id}')
def delete_project_timeline(project_id):
    data = Request.json
    milestone = data.get('milestone')

    if not milestone:
        return JSONResponse({"error": "Milestone is required"}), 400

    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM pmo.project_timelines
            WHERE project_id = %s AND milestone = %s
        """, (project_id, milestone))
        conn.commit()

        return JSONResponse(content={"message": "Timeline deleted successfully"}), 200
    except psycopg2.Error as e:
        print(f"Error during deletion of project timeline: {e}")
        return JSONResponse({"error": str(e)}), 400
    finally:
        if conn:
            release_pg_connection(conn)

@projects_router.get('/projects_filter')
async def filter_projects(
    strategic_portfolio: str = None,
    product_line: str = None,
    technology_project: str = None
) -> JSONResponse:
    """
    Filter projects by strategic_portfolio, product_line, and/or technology_project.
    Accepts query parameters.
    """
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        base_query = """
            SELECT project_id, project_name, strategic_portfolio, product_line, project_type, project_description, vitality, strategic, aim, revenue_est_growth_pa, revenue_est_current_year, revenue_est_current_year_plus_1, revenue_est_current_year_plus_2, revenue_est_current_year_plus_3, start_date_est, end_date_est, start_date_actual, end_date_actual, current_status, rag_status, comments, added_by, added_date, updated_by, updated_date, timesheet_project_name, technology_project
            FROM pmo.projects
        """
        where_clauses = []
        params = []

        if strategic_portfolio:
            where_clauses.append("strategic_portfolio = %s")
            params.append(strategic_portfolio)
        if product_line:
            where_clauses.append("product_line = %s")
            params.append(product_line)
        if technology_project:
            where_clauses.append("technology_project = %s")
            params.append(technology_project)

        if where_clauses:
            base_query += " WHERE " + " AND ".join(where_clauses)

        cursor.execute(base_query, params)
        projects = cursor.fetchall()
        projects = [dict(project) for project in projects]

        # Extract project IDs
        project_ids = [project['project_id'] for project in projects]

        # Fetch project summaries for all projects
        summary_response = get_allocation_project_summary(project_ids=project_ids)
        if summary_response.status_code == 200:
            project_summaries = json.loads(summary_response.body.decode("utf-8"))
        else:
            project_summaries = {}

        # Fetch resource role summaries for all projects
        role_summary_response = get_allocation_resource_role_summary(project_ids=project_ids)
        if role_summary_response.status_code == 200:
            role_summaries = json.loads(role_summary_response.body.decode("utf-8"))
        else:
            role_summaries = {}

        # Consolidate data into the projects list
        for project in projects:
            project_id = project['project_id']

            # Format dates
            if project['start_date_est']:
                project['start_date_est'] = project['start_date_est'].strftime('%Y-%m-%d')
            if project['end_date_est']:
                project['end_date_est'] = project['end_date_est'].strftime('%Y-%m-%d')
            if project['start_date_actual']:
                project['start_date_actual'] = project['start_date_actual'].strftime('%Y-%m-%d')
            if project['end_date_actual']:
                project['end_date_actual'] = project['end_date_actual'].strftime('%Y-%m-%d')

            # Add project summary data
            summary_data = project_summaries.get(str(project_id), {})
            project['project_resource_hours_planned'] = round(summary_data.get('total_resource_hours_planned', 0), 1)
            project['project_resource_cost_planned'] = round(summary_data.get('total_resource_cost_planned', 0), 2)
            project['project_resource_hours_actual'] = round(summary_data.get('total_resource_hours_actual', 0), 1)
            project['project_resource_cost_actual'] = round(summary_data.get('total_resource_cost_actual', 0), 2)

            # Add resource role summary data directly without the "role_summary" level
            project['resource_role_summary'] = role_summaries.get(str(project_id), {})

        projects = convert_decimal_to_float(projects)
        return JSONResponse(content=projects)
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)

@projects_router.post('/projects/dynamic_filter')
async def projects_dynamic_filter(
    body: dict = Body(...)
) -> JSONResponse:
    """
    Dynamically filter projects and select response fields.
    Request body should contain:
    - filters: list of {"column", "operator", "value"}
    - logical_operator: "AND" or "OR" (defaults to "AND")
    - fields: list of additional columns to return (besides the constants)
    """
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        filters = body.get("filters", [])
        logical_operator = body.get("logical_operator", "AND").upper() if body.get("logical_operator") else "AND"
        field_map = {
            # DB columns
            "project_id": "project_id",
            "project_name": "project_name",
            "strategic_portfolio": "strategic_portfolio",
            "product_line": "product_line",
            "project_type": "project_type",
            "project_description": "project_description",
            "vitality": "vitality",
            "strategic": "strategic",
            "aim": "aim",
            "revenue_est_growth_pa": "revenue_est_growth_pa",
            "revenue_est_current_year": "revenue_est_current_year",
            "revenue_est_current_year_plus_1": "revenue_est_current_year_plus_1",
            "revenue_est_current_year_plus_2": "revenue_est_current_year_plus_2",
            "revenue_est_current_year_plus_3": "revenue_est_current_year_plus_3",
            "start_date_est": "start_date_est",
            "end_date_est": "end_date_est",
            "start_date_actual": "start_date_actual",
            "end_date_actual": "end_date_actual",
            "current_status": "current_status",
            "rag_status": "rag_status",
            "comments": "comments",
            "added_by": "added_by",
            "added_date": "added_date",
            "updated_by": "updated_by",
            "updated_date": "updated_date",
            "timesheet_project_name": "timesheet_project_name",
            "technology_project": "technology_project",
            # Derived fields
            "resource_hours_planned": "project_resource_hours_planned",
            "resource_cost_planned": "project_resource_cost_planned",
            "resource_hours_actual": "project_resource_hours_actual",
            "resource_cost_actual": "project_resource_cost_actual",
            "resource_role_summary": "resource_role_summary"
        }
        constant_fields = ["project_id", "project_name", "strategic_portfolio", "product_line"]
        derived_keywords = [
            'cost', 'hours', 'resource_role_summary', 'resource_details',
            'project_resource_hours_planned', 'project_resource_cost_planned',
            'project_resource_hours_actual', 'project_resource_cost_actual',
            'resource_hours_planned', 'resource_cost_planned',
            'resource_hours_actual', 'resource_cost_actual'
        ]
        requested_fields = body.get("fields", [])
        # Check for 'all', 'all columns', 'all_columns' in requested_fields
        all_columns_requested = any(f.lower() in ["all", "all columns", "all_columns"] for f in requested_fields)
        if all_columns_requested:
            # All DB columns and all derived fields
            db_column_names = [v for k, v in field_map.items() if v not in [
                'project_resource_hours_planned', 'project_resource_cost_planned',
                'project_resource_hours_actual', 'project_resource_cost_actual',
                'resource_role_summary'
            ]]
            has_derived = True
        else:
            has_derived = any(any(keyword in f for keyword in derived_keywords) for f in requested_fields)
            db_column_names = [field_map[f] for f in requested_fields if f in field_map and field_map[f] not in [
                'project_resource_hours_planned', 'project_resource_cost_planned',
                'project_resource_hours_actual', 'project_resource_cost_actual',
                'resource_role_summary'
            ]]
        select_fields = constant_fields + db_column_names
        select_clause = ", ".join(select_fields)
        where_clauses = []
        params = []
        for f in filters:
            col = f.get("column")
            op = f.get("operator", "=")
            val = f.get("value")
            if col and op and val is not None:
                where_clauses.append(f"{col} {op} %s")
                params.append(val)
        where_sql = ""
        if where_clauses:
            where_sql = " WHERE " + f" {logical_operator} ".join(where_clauses)
        query = f"SELECT {select_clause} FROM pmo.projects{where_sql}"
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute(query, params)
        projects = cursor.fetchall()
        projects = [dict(project) for project in projects]
        project_ids = [project['project_id'] for project in projects if 'project_id' in project]
        summary_response = get_allocation_project_summary(project_ids=project_ids)
        if summary_response.status_code == 200:
            project_summaries = json.loads(summary_response.body.decode("utf-8"))
        else:
            project_summaries = {}
        role_summary_response = get_allocation_resource_role_summary(project_ids=project_ids)
        if role_summary_response.status_code == 200:
            role_summaries = json.loads(role_summary_response.body.decode("utf-8"))
        else:
            role_summaries = {}
        # Set allowed_fields for filtering response
        if has_derived:
            allowed_fields = set(constant_fields + [
                'project_resource_hours_planned', 'project_resource_cost_planned',
                'project_resource_hours_actual', 'project_resource_cost_actual',
                'resource_role_summary'
            ] + db_column_names)
        else:
            allowed_fields = set(constant_fields + db_column_names)
        for project in projects:
            project_id = project.get('project_id')
            for date_field in ["start_date_est", "end_date_est", "start_date_actual", "end_date_actual"]:
                if date_field in project and project[date_field]:
                    project[date_field] = project[date_field].strftime('%Y-%m-%d')
            if has_derived:
                summary_data = project_summaries.get(str(project_id), {})
                project['project_resource_hours_planned'] = round(summary_data.get('total_resource_hours_planned', 0), 1)
                project['project_resource_cost_planned'] = round(summary_data.get('total_resource_cost_planned', 0), 2)
                project['project_resource_hours_actual'] = round(summary_data.get('total_resource_hours_actual', 0), 1)
                project['project_resource_cost_actual'] = round(summary_data.get('total_resource_cost_actual', 0), 2)
                project['resource_role_summary'] = role_summaries.get(str(project_id), {})
            filtered_project = {k: v for k, v in project.items() if k in allowed_fields}
            project.clear()
            project.update(filtered_project)
        projects = convert_decimal_to_float(projects)
        return JSONResponse(content=projects)
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)

######################################################################
#      PROJECT ESTIMATION Related Operations
######################################################################

@projects_router.get('/project_estimation')
async def get_project_estimation(project_id: int = None) -> JSONResponse:
    """
    Fetch project estimation records from pmo.project_estimation table.
    Optionally filter by project_id.
    
    Args:
        project_id (int): Optional filter by project_id (query parameter).
    
    Returns:
        JSONResponse: A response containing the project estimation records.
    """
    conn = None
    try:
        conn = get_pg_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        cursor = conn.cursor(cursor_factory=DictCursor)
        
        # Build query with optional filter
        if project_id is not None:
            query = """
                SELECT 
                    estimation_id,
                    project_id,
                    milestone,
                    deliverable,
                    resources,
                    duration,
                    unit,
                    person_days,
                    created_date,
                    modified_date
                FROM pmo.project_estimation
                WHERE project_id = %s
                ORDER BY estimation_id
            """
            cursor.execute(query, (project_id,))
        else:
            query = """
                SELECT 
                    estimation_id,
                    project_id,
                    milestone,
                    deliverable,
                    resources,
                    duration,
                    unit,
                    person_days,
                    created_date,
                    modified_date
                FROM pmo.project_estimation
                ORDER BY project_id, estimation_id
            """
            cursor.execute(query)
        
        estimations = cursor.fetchall()
        
        # Convert to list of dictionaries
        estimations = [dict(estimation) for estimation in estimations]
        
        # Convert Decimal and date objects to JSON-serializable types
        estimations = convert_decimal_to_float(estimations)
        
        cursor.close()
        
        return JSONResponse(content=estimations, status_code=200)
        
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)

@projects_router.post('/upsert_project_estimation')
async def upsert_project_estimation(request: Request) -> JSONResponse:
    """
    Upsert (insert or update) a project estimation record in pmo.project_estimation table.
    If estimation_id is provided and exists, updates the record; otherwise inserts a new one.
    
    Request body should contain:
        - estimation_id (int, optional): If provided, updates existing record
        - project_id (int, required)
        - milestone (str, required)
        - deliverable (str, optional)
        - resources (float, required)
        - duration (float, required)
        - unit (str, required): Must be 'days', 'weeks', or 'months'
        - person_days (float, required)
    
    Returns:
        JSONResponse: A response indicating success or failure.
    """
    conn = None
    try:
        data = await request.json()
        
        # Validate required fields
        if not data.get('project_id'):
            raise HTTPException(status_code=400, detail="project_id is required")
        if not data.get('milestone'):
            raise HTTPException(status_code=400, detail="milestone is required")
        if data.get('resources') is None:
            raise HTTPException(status_code=400, detail="resources is required")
        if data.get('duration') is None:
            raise HTTPException(status_code=400, detail="duration is required")
        if not data.get('unit'):
            raise HTTPException(status_code=400, detail="unit is required")
        if data.get('person_days') is None:
            raise HTTPException(status_code=400, detail="person_days is required")
        
        # Validate unit
        valid_units = ['days', 'weeks', 'months']
        if data.get('unit') not in valid_units:
            raise HTTPException(
                status_code=400, 
                detail=f"unit must be one of: {', '.join(valid_units)}"
            )
        
        # Validate numeric values
        if float(data.get('resources')) < 0:
            raise HTTPException(status_code=400, detail="resources cannot be negative")
        if float(data.get('duration')) < 0:
            raise HTTPException(status_code=400, detail="duration cannot be negative")
        if float(data.get('person_days')) < 0:
            raise HTTPException(status_code=400, detail="person_days cannot be negative")
        
        conn = get_pg_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        cursor = conn.cursor()
        
        estimation_id = data.get('estimation_id')
        
        if estimation_id:
            # Update existing record
            update_query = """
                UPDATE pmo.project_estimation
                SET 
                    project_id = %s,
                    milestone = %s,
                    deliverable = %s,
                    resources = %s,
                    duration = %s,
                    unit = %s,
                    person_days = %s,
                    modified_date = NOW()
                WHERE estimation_id = %s
            """
            cursor.execute(
                update_query,
                (
                    data.get('project_id'),
                    data.get('milestone'),
                    data.get('deliverable'),
                    data.get('resources'),
                    data.get('duration'),
                    data.get('unit'),
                    data.get('person_days'),
                    estimation_id
                )
            )
            
            if cursor.rowcount == 0:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Project estimation with estimation_id {estimation_id} not found"
                )
            
            message = "Project estimation updated successfully"
        else:
            # Insert new record
            insert_query = """
                INSERT INTO pmo.project_estimation (
                    project_id,
                    milestone,
                    deliverable,
                    resources,
                    duration,
                    unit,
                    person_days,
                    created_date,
                    modified_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                RETURNING estimation_id
            """
            cursor.execute(
                insert_query,
                (
                    data.get('project_id'),
                    data.get('milestone'),
                    data.get('deliverable'),
                    data.get('resources'),
                    data.get('duration'),
                    data.get('unit'),
                    data.get('person_days')
                )
            )
            
            new_estimation_id = cursor.fetchone()[0]
            message = f"Project estimation created successfully with estimation_id {new_estimation_id}"
        
        conn.commit()
        cursor.close()
        
        return JSONResponse(
            content={"message": message},
            status_code=201 if not estimation_id else 200
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