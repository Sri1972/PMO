"""
Screener Service - Dynamic Query Builder for PMO Data

This service provides 3 core dynamic filtering endpoints:
1. Projects - Filter and select project fields with dynamic criteria
2. Resources - Filter and select resource fields with dynamic criteria  
3. Resource Capacity Allocation - Filter capacity/allocation data with pre/post query filters

Each endpoint supports:
- Dynamic field selection (choose which fields to return)
- Flexible filtering with multiple operators (=, !=, >, <, >=, <=, LIKE, IN)
- Logical operators (AND/OR) for combining filters
- Pre-query filters (database-level for performance)
- Post-query filters (calculated fields not in database)
"""

from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from db_utils_pg import get_pg_connection, release_pg_connection
import json
import psycopg2
from psycopg2.extras import DictCursor
from resource_allocation import get_allocation_project_summary, get_allocation_resource_role_summary
from utils import convert_decimal_to_float
from resources import get_resource_capacity_allocation_route
from datetime import datetime

screener_router = APIRouter()


######################################################################
#      1. PROJECT SCREENER
######################################################################

@screener_router.post('/screener_projects')
async def screener_projects_dynamic(
    body: dict = Body(
        ...,
        example={
            'filters': [
                {'column': 'strategic_portfolio', 'operator': '=', 'value': 'Market & Sell'},
                {'column': 'current_status', 'operator': '=', 'value': 'Active'}
            ],
            'logical_operator': 'AND',
            'fields': ['project_id', 'project_name', 'strategic_portfolio', 'product_line', 
                      'current_status', 'resource_hours_planned', 'resource_cost_planned']
        }
    )
):
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail='Database connection failed')
    
    try:
        filters = body.get('filters', [])
        logical_operator = body.get('logical_operator', 'AND').upper()
        requested_fields = body.get('fields', [])
        
        # Field mapping
        field_map = {
            'project_id': 'project_id',
            'project_name': 'project_name',
            'strategic_portfolio': 'strategic_portfolio',
            'product_line': 'product_line',
            'project_type': 'project_type',
            'project_description': 'project_description',
            'vitality': 'vitality',
            'strategic': 'strategic',
            'aim': 'aim',
            'revenue_est_growth_pa': 'revenue_est_growth_pa',
            'revenue_est_current_year': 'revenue_est_current_year',
            'revenue_est_current_year_plus_1': 'revenue_est_current_year_plus_1',
            'revenue_est_current_year_plus_2': 'revenue_est_current_year_plus_2',
            'revenue_est_current_year_plus_3': 'revenue_est_current_year_plus_3',
            'start_date_est': 'start_date_est',
            'end_date_est': 'end_date_est',
            'start_date_actual': 'start_date_actual',
            'end_date_actual': 'end_date_actual',
            'current_status': 'current_status',
            'rag_status': 'rag_status',
            'comments': 'comments',
            'timesheet_project_name': 'timesheet_project_name',
            'technology_project': 'technology_project',
            # Calculated fields
            'resource_hours_planned': 'project_resource_hours_planned',
            'resource_cost_planned': 'project_resource_cost_planned',
            'resource_hours_actual': 'project_resource_hours_actual',
            'resource_cost_actual': 'project_resource_cost_actual',
            'resource_role_summary': 'resource_role_summary'
        }
        
        constant_fields = ['project_id', 'project_name', 'strategic_portfolio', 'product_line']
        calculated_fields = [
            'project_resource_hours_planned', 'project_resource_cost_planned',
            'project_resource_hours_actual', 'project_resource_cost_actual',
            'resource_role_summary'
        ]
        
        # Check if all fields requested
        all_fields_requested = any(f.lower() in ['all', 'all columns', 'all_columns'] for f in requested_fields)
        
        if all_fields_requested:
            db_column_names = [v for k, v in field_map.items() if v not in calculated_fields]
            has_calculated = True
        else:
            has_calculated = any(
                field_map.get(f) in calculated_fields for f in requested_fields
            )
            db_column_names = [
                field_map[f] for f in requested_fields 
                if f in field_map and field_map[f] not in calculated_fields
            ]
        
        # Build SELECT clause
        select_fields = list(set(constant_fields + db_column_names))
        select_clause = ', '.join(select_fields)
        
        # Build WHERE clause
        where_clauses = []
        params = []
        
        for f in filters:
            col = f.get('column')
            op = f.get('operator', '=')
            val = f.get('value')
            
            if col and op and val is not None:
                if op.upper() == 'IN':
                    placeholders = ', '.join(['%s'] * len(val))
                    where_clauses.append(f'{col} IN ({placeholders})')
                    params.extend(val)
                else:
                    where_clauses.append(f'{col} {op} %s')
                    params.append(val)
        
        where_sql = ''
        if where_clauses:
            where_sql = ' WHERE ' + f' {logical_operator} '.join(where_clauses)
        
        # Execute query
        query = f'SELECT {select_clause} FROM pmo.projects{where_sql}'
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute(query, params)
        projects = cursor.fetchall()
        projects = [dict(project) for project in projects]
        
        project_ids = [project['project_id'] for project in projects]
        
        # Fetch calculated fields if needed
        if has_calculated and project_ids:
            summary_response = get_allocation_project_summary(project_ids=project_ids)
            if summary_response.status_code == 200:
                project_summaries = json.loads(summary_response.body.decode('utf-8'))
            else:
                project_summaries = {}
            
            role_summary_response = get_allocation_resource_role_summary(project_ids=project_ids)
            if role_summary_response.status_code == 200:
                role_summaries = json.loads(role_summary_response.body.decode('utf-8'))
            else:
                role_summaries = {}
        
        # Build allowed fields for response
        if has_calculated:
            allowed_fields = set(constant_fields + db_column_names + calculated_fields)
        else:
            allowed_fields = set(constant_fields + db_column_names)
        
        # Enrich each project
        for project in projects:
            project_id = project.get('project_id')
            
            # Format dates
            for date_field in ['start_date_est', 'end_date_est', 'start_date_actual', 'end_date_actual']:
                if date_field in project and project[date_field]:
                    project[date_field] = project[date_field].strftime('%Y-%m-%d')
            
            # Add calculated fields if requested
            if has_calculated:
                summary_data = project_summaries.get(str(project_id), {})
                project['project_resource_hours_planned'] = round(summary_data.get('total_resource_hours_planned', 0), 1)
                project['project_resource_cost_planned'] = round(summary_data.get('total_resource_cost_planned', 0), 2)
                project['project_resource_hours_actual'] = round(summary_data.get('total_resource_hours_actual', 0), 1)
                project['project_resource_cost_actual'] = round(summary_data.get('total_resource_cost_actual', 0), 2)
                project['resource_role_summary'] = role_summaries.get(str(project_id), {})
            
            # Filter to only allowed fields
            filtered_project = {k: v for k, v in project.items() if k in allowed_fields}
            project.clear()
            project.update(filtered_project)
        
        projects = convert_decimal_to_float(projects)
        return JSONResponse(content=projects)
        
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=f'Database error: {str(e)}')
    finally:
        if conn:
            release_pg_connection(conn)


######################################################################
#      2. RESOURCE SCREENER
######################################################################

@screener_router.post('/screener_resources')
async def screener_resources_dynamic(
    body: dict = Body(
        ...,
        example={
            'filters': [
                {'column': 'resource_role', 'operator': '=', 'value': 'Full Stack Developer'},
                {'column': 'strategic_portfolio', 'operator': '=', 'value': 'Market & Sell'}
            ],
            'logical_operator': 'AND',
            'fields': ['resource_id', 'resource_name', 'resource_role', 'resource_email', 
                      'strategic_portfolio', 'product_line', 'yearly_capacity']
        }
    )
):
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail='Database connection failed')
    
    try:
        filters = body.get('filters', [])
        logical_operator = body.get('logical_operator', 'AND').upper()
        requested_fields = body.get('fields', [])
        
        # Available resource fields
        available_fields = [
            'resource_id', 'resource_name', 'resource_email', 'resource_type',
            'strategic_portfolio', 'product_line', 'manager_name', 'manager_email',
            'resource_role', 'responsibility', 'skillset', 'comments', 
            'yearly_capacity', 'timesheet_resource_name'
        ]
        
        constant_fields = ['resource_id', 'resource_name']
        
        # Check if all fields requested
        all_fields_requested = any(f.lower() in ['all', 'all columns', 'all_columns'] for f in requested_fields)
        
        if all_fields_requested:
            select_fields = available_fields
        else:
            select_fields = list(set(constant_fields + [f for f in requested_fields if f in available_fields]))
        
        select_clause = ', '.join(select_fields)
        
        # Build WHERE clause
        where_clauses = []
        params = []
        
        for f in filters:
            col = f.get('column')
            op = f.get('operator', '=')
            val = f.get('value')
            
            if col and op and val is not None:
                if op.upper() == 'IN':
                    placeholders = ', '.join(['%s'] * len(val))
                    where_clauses.append(f'{col} IN ({placeholders})')
                    params.extend(val)
                else:
                    where_clauses.append(f'{col} {op} %s')
                    params.append(val)
        
        where_sql = ''
        if where_clauses:
            where_sql = ' WHERE ' + f' {logical_operator} '.join(where_clauses)
        
        # Execute query
        query = f'SELECT {select_clause} FROM pmo.resources{where_sql}'
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute(query, params)
        resources = cursor.fetchall()
        resources = [dict(resource) for resource in resources]
        
        resources = convert_decimal_to_float(resources)
        return JSONResponse(content=resources)
        
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=f'Database error: {str(e)}')
    finally:
        if conn:
            release_pg_connection(conn)


######################################################################
#      3. RESOURCE CAPACITY ALLOCATION SCREENER
######################################################################

@screener_router.post('/screener_resource_capacity_allocation')
async def screener_resource_capacity_allocation_dynamic(
    body: dict = Body(
        ...,
        example={
            'resource_ids': [1, 2, 3],
            'start_date': '2025-01-01',
            'end_date': '2025-12-31',
            'interval': 'Monthly',
            'pre_filters': [
                {'field': 'project_id', 'operator': '=', 'value': 2}
            ],
            'post_filters': [
                {'field': 'allocation_hours_planned', 'operator': '>', 'value': 10},
                {'field': 'available_capacity', 'operator': '<', 'value': 100}
            ],
            'response_fields': ['start_date', 'end_date', 'total_capacity', 
                               'allocation_hours_planned', 'available_capacity']
        }
    )
):
    resource_ids = body.get('resource_ids', [])
    start_date = body.get('start_date', f'{datetime.now().year}-01-01')
    end_date = body.get('end_date', f'{datetime.now().year}-12-31')
    interval = body.get('interval', 'Monthly')
    pre_filters = body.get('pre_filters', [])
    post_filters = body.get('post_filters', [])
    response_fields = body.get('response_fields', [])
    
    if not resource_ids:
        raise HTTPException(status_code=400, detail='resource_ids is required')
    
    # Extract project_id from pre_filters
    project_id = None
    for f in pre_filters:
        if f.get('field') == 'project_id':
            project_id = f.get('value')
            break
    
    # Helper function to apply filters
    def apply_filter(value, operator, target):
        try:
            if operator == '=':
                return value == target
            elif operator == '!=':
                return value != target
            elif operator == '>':
                return float(value) > float(target)
            elif operator == '<':
                return float(value) < float(target)
            elif operator == '>=':
                return float(value) >= float(target)
            elif operator == '<=':
                return float(value) <= float(target)
        except (ValueError, TypeError):
            return False
        return True
    
    def filter_intervals(intervals, filters):
        if not filters:
            return intervals
        
        filtered = []
        for interval_data in intervals:
            matches = True
            for f in filters:
                field = f.get('field')
                operator = f.get('operator', '=')
                value = f.get('value')
                
                # Get value from interval data
                actual_value = interval_data.get(field)
                
                # Check in project_allocation_details if not found
                if actual_value is None and 'project_allocation_details' in interval_data:
                    for detail in interval_data['project_allocation_details']:
                        if field in detail:
                            actual_value = detail.get(field)
                            break
                
                if actual_value is not None:
                    if not apply_filter(actual_value, operator, value):
                        matches = False
                        break
            
            if matches:
                filtered.append(interval_data)
        
        return filtered
    
    # Fetch data for all resources
    all_results = []
    
    for resource_id in resource_ids:
        response = await get_resource_capacity_allocation_route(
            resource_id=str(resource_id),
            start_date=start_date,
            end_date=end_date,
            interval=interval,
            project_id=project_id
        )
        
        if response.status_code == 200:
            try:
                data = json.loads(response.body.decode('utf-8'))
                
                # Apply post-query filters
                if 'data' in data:
                    data['data'] = filter_intervals(data['data'], post_filters)
                
                # Apply field selection
                if response_fields:
                    filtered_data = []
                    for interval_data in data.get('data', []):
                        filtered_interval = {k: v for k, v in interval_data.items() if k in response_fields}
                        filtered_data.append(filtered_interval)
                    data['data'] = filtered_data
                
                all_results.append(data)
            except (json.JSONDecodeError, AttributeError):
                continue
    
    return JSONResponse(content=all_results, status_code=200)
