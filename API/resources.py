from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import JSONResponse
from db_utils_pg import get_pg_connection, release_pg_connection
import psycopg2
from psycopg2.extras import DictCursor
from datetime import datetime, timedelta, date
from resource_allocation import get_allocations_by_project
from utils import convert_decimal_to_float  # Import the utility function
import json  # Import the json module
import asyncio
import unicodedata
import re
from decimal import Decimal

resources_router = APIRouter()

######################################################################
#      RESOURCES Related Operations
######################################################################

# Retrieve all resources
@resources_router.get('/resources')
def get_resources():
    conn = get_pg_connection()  # PostgreSQL connection
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)  # PostgreSQL cursor
        cursor.execute("""
            SELECT resource_id, resource_name, resource_email, resource_type, strategic_portfolio, product_line, manager_name, manager_email, resource_role, responsibility, skillset, comments, yearly_capacity, timesheet_resource_name
            FROM pmo.resources
        """)
        resources = cursor.fetchall()

        # Convert rows to a list of dictionaries
        resources = [dict(resource) for resource in resources]

        cursor.close()
        return JSONResponse(content=resources)  # Return as JSON
    except psycopg2.Error as e:  # PostgreSQL error handling
        return JSONResponse({"error": str(e)}), 400
    finally:
        if conn:
            release_pg_connection(conn)

# Retrieve resource by ID
@resources_router.get('/resources/{resource_id}')
def get_resource_by_id(resource_id):
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("""
            SELECT resource_id, resource_name, resource_email, resource_type, strategic_portfolio, product_line, manager_name, manager_email, resource_role, responsibility, skillset, comments, yearly_capacity, timesheet_resource_name
            FROM pmo.resources
            WHERE resource_id = %s
        """, (resource_id,))
        resource = cursor.fetchone()
        cursor.close()
        return JSONResponse(resource)
    except psycopg2.Error as e:
        return JSONResponse({"error": str(e)}), 400
    finally:
        if conn:
            release_pg_connection(conn)

# Insert record into resources table
@resources_router.post('/resources')
def add_resource():
    data = Request.json()
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO pmo.resources (resource_name, resource_email, resource_type, strategic_portfolio, product_line, manager_name, manager_email, resource_role, responsibility, skillset, comments, yearly_capacity, timesheet_resource_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (data['resource_name'], data['resource_email'], data['resource_type'], data['strategic_portfolio'], data['product_line'], data['manager_name'], data['manager_email'], data['resource_role'], data['responsibility'], data['skillset'], data['comments'], data['yearly_capacity'], data['timesheet_resource_name']))
        conn.commit()
        return JSONResponse({"message": "Resource added successfully"}), 201
    except psycopg2.Error as e:
        return JSONResponse({"error": str(e)}), 400
    finally:
        if conn:
            release_pg_connection(conn)

######################################################################
#      RESOURCE CAPACITY AND ALLOCATION Related Operations
######################################################################

# Retrieve resource capacity for a given time period and in weekly or monthly intervals
@resources_router.get('/resource_capacity')
async def get_resource_capacity(request: Request):
    resource_id = request.query_params.get('resource_id')
    start_date = request.query_params.get('start_date', f"{datetime.now().year}-01-01")
    end_date = request.query_params.get('end_date', f"{datetime.now().year}-12-31")
    interval = request.query_params.get('interval', 'Monthly')  # Default to Monthly

    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor(cursor_factory=DictCursor)

        # Get yearly capacity and resource details for the resource
        cursor.execute("""
            SELECT resource_id, resource_name, resource_email, resource_type, strategic_portfolio, product_line, 
                   manager_name, manager_email, resource_role, responsibility, skillset, comments, yearly_capacity, 
                   timesheet_resource_name
            FROM pmo.resources 
            WHERE resource_id = %s
        """, (resource_id,))
        resource = cursor.fetchone()
        if not resource:
            return JSONResponse({"error": "Resource not found"}), 404

        resource_details = {
            "resource_id": resource['resource_id'],
            "resource_name": resource['resource_name'],
            "resource_email": resource['resource_email'],
            "resource_type": resource['resource_type'],
            "strategic_portfolio": resource['strategic_portfolio'],
            "product_line": resource['product_line'],
            "manager_name": resource['manager_name'],
            "manager_email": resource['manager_email'],
            "resource_role": resource['resource_role'],
            "responsibility": resource['responsibility'],
            "skillset": resource['skillset'],
            "comments": resource['comments'],
            "yearly_capacity": resource['yearly_capacity'],
            "timesheet_resource_name": resource['timesheet_resource_name']
        }

        yearly_capacity = resource['yearly_capacity']
        daily_capacity = yearly_capacity / 261  # 261 weekdays in a year

        # Generate daily intervals excluding weekends
        start_date = datetime.strptime(start_date, '%Y-%m-%d')
        end_date = datetime.strptime(end_date, '%Y-%m-%d')
        days = []
        current_date = start_date
        while current_date <= end_date:
            if current_date.weekday() < 5:  # Monday to Friday are 0-4
                days.append(current_date)
            current_date += timedelta(days=1)

        # Get time off data for the resource
        cursor.execute("""
            SELECT resource_id, DATE(timeoff_start_date) AS timeoff_start_date, DATE(timeoff_end_date) AS timeoff_end_date, reason
            FROM pmo.timeoff
            WHERE resource_id = %s AND timeoff_start_date <= %s AND timeoff_end_date >= %s
        """, (resource_id, end_date, start_date))
        timeoffs = cursor.fetchall()

        # Calculate adjusted daily capacity
        daily_data = []
        for day in days:
            total_capacity = daily_capacity
            for timeoff in timeoffs:
                timeoff_start = timeoff['timeoff_start_date']
                timeoff_end = timeoff['timeoff_end_date']
                if timeoff_start <= day.date() <= timeoff_end:
                    total_capacity = 0
                    break
            # PATCH: Add allocation_hours_planned, allocation_hours_actual, available_capacity for compatibility
            daily_data.append({
                "date": day.strftime('%Y-%m-%d'),
                "total_capacity": total_capacity,
                "allocation_hours_planned": 0,
                "allocation_hours_actual": 0,
                "available_capacity": total_capacity
            })

        if interval == 'Weekly':
            # --- FIX: Proper weekly aggregation: always Monday-Sunday, clamp to date range ---
            weekly_capacity_data = []
            cumulative_hours = 0
            n = len(daily_data)
            i = 0
            while i < n:
                current_date = datetime.strptime(daily_data[i]['date'], '%Y-%m-%d')
                week_start = current_date - timedelta(days=current_date.weekday())
                week_end = week_start + timedelta(days=6)
                # Clamp week_start and week_end to the requested range
                if week_start < start_date:
                    week_start = start_date
                if week_end > end_date:
                    week_end = end_date
                week_data = []
                while i < n and datetime.strptime(daily_data[i]['date'], '%Y-%m-%d') <= week_end:
                    week_data.append(daily_data[i])
                    i += 1
                if week_data:
                    weekly_capacity = sum(day['total_capacity'] for day in week_data)
                    cumulative_hours += weekly_capacity
                    weekly_capacity_data.append({
                        "start_date": week_start.strftime('%Y-%m-%d'),
                        "end_date": week_end.strftime('%Y-%m-%d'),
                        "total_capacity": round(weekly_capacity, 1),
                        "cumulative_hours": round(cumulative_hours, 1)
                    })
            result = weekly_capacity_data

        elif interval == 'Monthly':
            # PATCH: Use new daily_data fields for aggregation to avoid KeyError
            monthly_capacity_data = []
            cumulative_hours = 0
            monthly_capacity = 0
            monthly_planned = 0
            monthly_actual = 0
            monthly_available = 0
            current_month = daily_data[0]['date'][:7]  # YYYY-MM

            for day in daily_data:
                month = day['date'][:7]
                if month == current_month:
                    monthly_capacity += day['total_capacity']
                    monthly_planned += day.get('allocation_hours_planned', 0)
                    monthly_actual += day.get('allocation_hours_actual', 0)
                    monthly_available += day.get('available_capacity', day['total_capacity'])
                else:
                    cumulative_hours += monthly_capacity
                    # Calculate month start and end dates
                    year, month_num = current_month.split('-')
                    month_start = f"{current_month}-01"
                    next_month = datetime(int(year), int(month_num), 1) + timedelta(days=32)
                    month_end = (next_month.replace(day=1) - timedelta(days=1)).strftime('%Y-%m-%d')
                    
                    monthly_capacity_data.append({
                        "start_date": month_start,
                        "end_date": month_end,
                        "total_capacity": round(monthly_capacity, 1),
                        "allocation_hours_planned": round(monthly_planned, 1),
                        "allocation_hours_actual": round(monthly_actual, 1),
                        "available_capacity": round(monthly_available, 1),
                        "cumulative_hours": round(cumulative_hours, 1)
                    })
                    current_month = month
                    monthly_capacity = day['total_capacity']
                    monthly_planned = day.get('allocation_hours_planned', 0)
                    monthly_actual = day.get('allocation_hours_actual', 0)
                    monthly_available = day.get('available_capacity', day['total_capacity'])

            # Add last month's data
            cumulative_hours += monthly_capacity
            # Calculate month start and end dates
            year, month_num = current_month.split('-')
            month_start = f"{current_month}-01"
            next_month = datetime(int(year), int(month_num), 1) + timedelta(days=32)
            month_end = (next_month.replace(day=1) - timedelta(days=1)).strftime('%Y-%m-%d')
            
            monthly_capacity_data.append({
                "start_date": month_start,
                "end_date": month_end,
                "total_capacity": round(monthly_capacity, 1),
                "allocation_hours_planned": round(monthly_planned, 1),
                "allocation_hours_actual": round(monthly_actual, 1),
                "available_capacity": round(monthly_available, 1),
                "cumulative_hours": round(cumulative_hours, 1)
            })

            result = monthly_capacity_data

        elif not interval or interval == '':
            # Block-based logic: group by changes in capacity data
            block_data = []
            if daily_data:
                current_block_start = datetime.strptime(daily_data[0]['date'], '%Y-%m-%d')
                current_block_capacity = float(daily_data[0]['total_capacity'])
                current_block_planned = float(daily_data[0]['allocation_hours_planned'])
                current_block_actual = float(daily_data[0]['allocation_hours_actual'])
                current_block_available = float(daily_data[0]['available_capacity'])
                
                def capacity_values_changed(day):
                    """Check if any capacity values have changed using tolerance for float comparison"""
                    tolerance = 0.001  # Small tolerance for floating point comparison
                    return (abs(float(day['total_capacity']) - current_block_capacity) > tolerance or
                            abs(float(day['allocation_hours_planned']) - current_block_planned) > tolerance or
                            abs(float(day['allocation_hours_actual']) - current_block_actual) > tolerance or
                            abs(float(day['available_capacity']) - current_block_available) > tolerance)
                
                for i, day in enumerate(daily_data[1:], 1):
                    # Check if any capacity data has changed
                    if capacity_values_changed(day):
                        
                        # End current block
                        block_end = datetime.strptime(daily_data[i-1]['date'], '%Y-%m-%d')
                        block_data.append({
                            "start_date": current_block_start.strftime('%Y-%m-%d'),
                            "end_date": block_end.strftime('%Y-%m-%d'),
                            "total_capacity": round(float(current_block_capacity), 1),
                            "allocation_hours_planned": round(float(current_block_planned), 1),
                            "allocation_hours_actual": round(float(current_block_actual), 1),
                            "available_capacity": round(float(current_block_available), 1)
                        })
                        
                        # Start new block
                        current_block_start = datetime.strptime(day['date'], '%Y-%m-%d')
                        current_block_capacity = float(day['total_capacity'])
                        current_block_planned = float(day['allocation_hours_planned'])
                        current_block_actual = float(day['allocation_hours_actual'])
                        current_block_available = float(day['available_capacity'])
                
                # Add the final block
                block_end = datetime.strptime(daily_data[-1]['date'], '%Y-%m-%d')
                block_data.append({
                    "start_date": current_block_start.strftime('%Y-%m-%d'),
                    "end_date": block_end.strftime('%Y-%m-%d'),
                    "total_capacity": round(current_block_capacity, 1),
                    "allocation_hours_planned": round(current_block_planned, 1),
                    "allocation_hours_actual": round(current_block_actual, 1),
                    "available_capacity": round(current_block_available, 1)
                })
            
            result = block_data

        # --- Round only at the end ---
        def round_capacity_entry(entry):
            for k in entry:
                if k in [
                    "total_capacity", "total_capacity_cumulative",
                    "allocation_hours_planned", "allocation_hours_actual",
                    "available_capacity", "available_capacity_cumulative",
                    "cumulative_planned", "cumulative_actual"
                ] and isinstance(entry[k], float):
                    entry[k] = round(entry[k], 1)
            return entry
        result = [round_capacity_entry(entry) for entry in result]
        result = convert_decimal_to_float(result)
        
        # Create final response with resource details at top level
        response = {
            "resource_details": resource_details,
            "data": result
        }
        
        cursor.close()
        return JSONResponse(response, status_code=200)
    except psycopg2.Error as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    finally:
        if conn:
            release_pg_connection(conn)

# Retrieve resource capacity and allocation (planned and actual) for all resources for a given time period and in weekly or monthly intervals
@resources_router.get('/resource_capacity_allocation')
async def get_resource_capacity_allocation_route(
    resource_id: str = Query(..., description="Resource ID"),
    start_date: str = Query(f"{datetime.now().year}-01-01", description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(f"{datetime.now().year}-12-31", description="End date (YYYY-MM-DD)"),
    interval: str = Query("Monthly", description="Interval: Weekly, Monthly, or empty for blocks"),
    project_id: int = Query(None, description="Optional: Filter project allocation details for specific project")
):
    """
    Retrieve resource capacity and allocation (planned and actual) for a resource for a given time period and in weekly or monthly intervals.
    """
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}, status_code=500)

    try:
        cursor = conn.cursor(cursor_factory=DictCursor)

        # Fetch yearly capacity and resource details
        cursor.execute("""
            SELECT resource_id, resource_name, resource_email, resource_type, strategic_portfolio, product_line, 
                   manager_name, manager_email, resource_role, responsibility, skillset, comments, yearly_capacity, 
                   timesheet_resource_name
            FROM pmo.resources 
            WHERE resource_id = %s
        """, (resource_id,))
        resource = cursor.fetchone()
        if not resource:
            return JSONResponse({"error": "Resource not found"}, status_code=404)

        resource_details = {
            "resource_id": resource['resource_id'],
            "resource_name": resource['resource_name'],
            "resource_email": resource['resource_email'],
            "resource_type": resource['resource_type'],
            "strategic_portfolio": resource['strategic_portfolio'],
            "product_line": resource['product_line'],
            "manager_name": resource['manager_name'],
            "manager_email": resource['manager_email'],
            "resource_role": resource['resource_role'],
            "responsibility": resource['responsibility'],
            "skillset": resource['skillset'],
            "comments": resource['comments'],
            "yearly_capacity": resource['yearly_capacity'],
            "timesheet_resource_name": resource['timesheet_resource_name']
        }

        yearly_capacity = resource['yearly_capacity']
        daily_capacity = yearly_capacity / 261  # 261 weekdays in a year

        # Generate daily intervals excluding weekends
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d')
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d')
        days = [start_date_obj + timedelta(days=i) for i in range((end_date_obj - start_date_obj).days + 1) if (start_date_obj + timedelta(days=i)).weekday() < 5]

        # Fetch timeoff data
        cursor.execute("""
            SELECT resource_id, DATE(timeoff_start_date) AS timeoff_start_date, DATE(timeoff_end_date) AS timeoff_end_date
            FROM pmo.timeoff
            WHERE resource_id = %s AND timeoff_start_date <= %s AND timeoff_end_date >= %s
        """, (resource_id, end_date, start_date))
        timeoffs = cursor.fetchall()

        # Fetch planned allocation data with project details
        allocation_query = """
            SELECT ra.resource_id, ra.project_id, p.project_name, 
                   DATE(ra.allocation_start_date) AS allocation_start_date, 
                   DATE(ra.allocation_end_date) AS allocation_end_date, 
                   ra.allocation_pct, ra.allocation_hrs_per_week
            FROM pmo.resource_allocation ra
            LEFT JOIN pmo.projects p ON ra.project_id = p.project_id
            WHERE ra.resource_id = %s AND ra.allocation_start_date <= %s AND ra.allocation_end_date >= %s
        """
        allocation_params = [resource_id, end_date, start_date]
        
        # Add project_id filter if provided
        if project_id is not None:
            allocation_query += " AND ra.project_id = %s"
            allocation_params.append(project_id)
            
        cursor.execute(allocation_query, allocation_params)
        allocations = cursor.fetchall()
        allocations = [dict(a) for a in allocations]

        # If project_id filter is specified and no allocations found, return empty array
        if project_id is not None and not allocations:
            cursor.close()
            return JSONResponse([], status_code=200)

        # Fetch actual hours from timesheet_entry with project details
        timesheet_query = """
            SELECT te.project_id, p.project_name, te.resource_id, te.ts_entry_date, 
                   SUM(te.ts_total_hrs) AS allocation_hours_actual
            FROM pmo.timesheet_entry te
            LEFT JOIN pmo.projects p ON te.project_id = p.project_id
            WHERE te.resource_id = %s AND te.ts_entry_date BETWEEN %s AND %s
        """
        timesheet_params = [resource_id, start_date, end_date]
        
        # Add project_id filter if provided
        if project_id is not None:
            timesheet_query += " AND te.project_id = %s"
            timesheet_params.append(project_id)
            
        timesheet_query += " GROUP BY te.project_id, p.project_name, te.resource_id, te.ts_entry_date"
        
        cursor.execute(timesheet_query, timesheet_params)
        actuals = cursor.fetchall()
        # {(date, project_id): actual_hours}
        actuals_map = {(row['ts_entry_date'], row['project_id']): row['allocation_hours_actual'] for row in actuals}

        # Create project name mapping
        project_names = {}
        for allocation in allocations:
            if allocation['project_id'] and allocation['project_name']:
                project_names[allocation['project_id']] = allocation['project_name']
        for actual in actuals:
            if actual['project_id'] and actual['project_name']:
                project_names[actual['project_id']] = actual['project_name']

        daily_data = []
        for day in days:
            total_capacity = daily_capacity
            planned_by_project = {}
            actual_by_project = {}
            
            # Planned per project
            for allocation in allocations:
                alloc_project_id = allocation['project_id']
                if allocation['allocation_start_date'] <= day.date() <= allocation['allocation_end_date']:
                    if allocation['allocation_pct']:
                        planned = Decimal(total_capacity) * (Decimal(allocation['allocation_pct']) / 100)
                    else:
                        planned = Decimal((allocation['allocation_hrs_per_week'] or 0) / 5)
                    planned_by_project[alloc_project_id] = planned_by_project.get(alloc_project_id, 0) + planned
            
            # Actual per project
            for (entry_date, actual_project_id), actual in actuals_map.items():
                if entry_date == day.date():
                    actual_by_project[actual_project_id] = actual_by_project.get(actual_project_id, 0) + actual

            # Calculate used hours (actual if present, else planned)
            used_hours = 0
            for proj_id in set(list(planned_by_project.keys()) + list(actual_by_project.keys())):
                if proj_id in actual_by_project and actual_by_project[proj_id] > 0:
                    used_hours += actual_by_project[proj_id]
                else:
                    used_hours += planned_by_project.get(proj_id, 0)

            # Timeoff logic
            for timeoff in timeoffs:
                if timeoff['timeoff_start_date'] <= day.date() <= timeoff['timeoff_end_date']:
                    total_capacity = 0
                    used_hours = 0
                    break

            total_capacity = Decimal(total_capacity)

            # Store daily data with project details
            daily_data.append({
                "date": day.strftime('%Y-%m-%d'),
                "total_capacity": total_capacity,
                "allocation_hours_planned": sum(
                    v for k, v in planned_by_project.items() if k not in actual_by_project
                ),
                "allocation_hours_actual": sum(actual_by_project.values()),
                "available_capacity": total_capacity - used_hours,
                "planned_by_project": planned_by_project,
                "actual_by_project": actual_by_project
            })

        # Always convert to blocks regardless of interval type for consistency
        # First, build intervals as before but with consistent date format
        intervals = []
        
        if interval == 'Weekly':
            # --- Build weekly intervals with proper boundaries that respect user's dates ---
            # Create a lookup for daily data by date
            daily_data_by_date = {day['date']: day for day in daily_data}
            
            # Generate week intervals based on user's date range
            current_date = start_date_obj
            
            while current_date <= end_date_obj:
                # Determine the end of current week (Sunday)
                days_until_sunday = (6 - current_date.weekday()) % 7
                week_end = current_date + timedelta(days=days_until_sunday)
                
                # Adjust week_end to not exceed user's end_date
                if week_end > end_date_obj:
                    week_end = end_date_obj
                
                # This interval runs from current_date to week_end
                interval_start = current_date
                interval_end = week_end
                
                # Collect daily data for this week interval
                week_days = []
                check_date = interval_start
                while check_date <= interval_end:
                    if check_date.weekday() < 5:  # Only weekdays have data
                        date_str = check_date.strftime('%Y-%m-%d')
                        if date_str in daily_data_by_date:
                            week_days.append(daily_data_by_date[date_str])
                    check_date += timedelta(days=1)
                
                # Aggregate data for this week interval
                weekly_capacity = sum(day['total_capacity'] for day in week_days) if week_days else 0
                weekly_planned = sum(day.get('allocation_hours_planned', 0) for day in week_days)
                weekly_actual = sum(day.get('allocation_hours_actual', 0) for day in week_days)
                weekly_available = sum(day.get('available_capacity', day['total_capacity']) for day in week_days)
                
                # Aggregate project data for the week
                weekly_planned_by_project = {}
                weekly_actual_by_project = {}
                
                for day in week_days:
                    for project_id, hours in day.get('planned_by_project', {}).items():
                        weekly_planned_by_project[project_id] = weekly_planned_by_project.get(project_id, 0) + hours
                    
                    for project_id, hours in day.get('actual_by_project', {}).items():
                        weekly_actual_by_project[project_id] = weekly_actual_by_project.get(project_id, 0) + hours
                
                # Create project allocation details with percentages for the week
                project_allocation_details = []
                all_project_ids = set(weekly_planned_by_project.keys()) | set(weekly_actual_by_project.keys())
                
                for project_id_iter in all_project_ids:
                    planned_hours = float(weekly_planned_by_project.get(project_id_iter, 0))
                    actual_hours = float(weekly_actual_by_project.get(project_id_iter, 0))
                    weekly_capacity_float = float(weekly_capacity) if weekly_capacity > 0 else 0.001  # Avoid division by zero
                    
                    project_allocation_details.append({
                        "project_id": project_id_iter,
                        "project_name": project_names.get(project_id_iter, "Unknown Project"),
                        "planned_hours": round(planned_hours, 2),
                        "actual_hours": round(actual_hours, 2),
                        "planned_percentage": round((planned_hours / weekly_capacity_float * 100) if weekly_capacity_float > 0 else 0, 2),
                        "actual_percentage": round((actual_hours / weekly_capacity_float * 100) if weekly_capacity_float > 0 else 0, 2)
                    })

                # Add the weekly interval (only if there's some data or if it covers the requested range)
                intervals.append({
                    "start_date": interval_start.strftime('%Y-%m-%d'),
                    "end_date": interval_end.strftime('%Y-%m-%d'),
                    "total_capacity": float(weekly_capacity),
                    "allocation_hours_planned": float(weekly_planned),
                    "allocation_hours_actual": float(weekly_actual),
                    "available_capacity": float(weekly_available),
                    "project_allocation_details": project_allocation_details
                })
                
                # Move to the next week (Monday after current week_end)
                current_date = interval_end + timedelta(days=1)
                # If the next date is not a Monday, move to the next Monday
                if current_date.weekday() != 0:  # 0 = Monday
                    days_to_monday = 7 - current_date.weekday()
                    current_date += timedelta(days=days_to_monday)
        elif interval == 'Monthly':
            # --- Build monthly intervals with proper calendar boundaries ---
            # Group daily data by calendar months
            months_data = {}
            
            # Process daily data and group by month
            for day in daily_data:
                month = day['date'][:7]  # YYYY-MM format
                if month not in months_data:
                    months_data[month] = []
                months_data[month].append(day)
            
            # Process each month and create intervals with proper boundaries
            for month_key in sorted(months_data.keys()):
                month_days = months_data[month_key]
                
                # Calculate proper month boundaries
                year, month_num = month_key.split('-')
                month_start = datetime(int(year), int(month_num), 1)
                
                # Calculate month end (last day of month)
                if int(month_num) == 12:
                    next_month_start = datetime(int(year) + 1, 1, 1)
                else:
                    next_month_start = datetime(int(year), int(month_num) + 1, 1)
                month_end = next_month_start - timedelta(days=1)
                
                # Determine if this is the first, middle, or last month in the sequence
                sorted_month_keys = sorted(months_data.keys())
                is_single_month = len(sorted_month_keys) == 1
                is_first_month = month_key == sorted_month_keys[0]
                is_last_month = month_key == sorted_month_keys[-1]
                
                # Set interval boundaries according to user requirements
                if is_single_month:
                    # Single month: use user's exact dates
                    interval_start = start_date_obj
                    interval_end = end_date_obj
                elif is_first_month:
                    # First month: user's start_date to end of month (or user's end_date if earlier)
                    interval_start = start_date_obj
                    interval_end = min(month_end, end_date_obj)
                elif is_last_month:
                    # Last month: start of month to user's end_date
                    interval_start = month_start
                    interval_end = end_date_obj
                else:
                    # Middle months: use full calendar month
                    interval_start = month_start
                    interval_end = month_end
                
                # Aggregate data for this month
                month_capacity = sum(day['total_capacity'] for day in month_days)
                month_planned = sum(day.get('allocation_hours_planned', 0) for day in month_days)
                month_actual = sum(day.get('allocation_hours_actual', 0) for day in month_days)
                month_available = sum(day.get('available_capacity', day['total_capacity']) for day in month_days)
                
                # Aggregate project data for the month
                monthly_planned_by_project = {}
                monthly_actual_by_project = {}
                
                for day in month_days:
                    for project_id, hours in day.get('planned_by_project', {}).items():
                        monthly_planned_by_project[project_id] = monthly_planned_by_project.get(project_id, 0) + hours
                    
                    for project_id, hours in day.get('actual_by_project', {}).items():
                        monthly_actual_by_project[project_id] = monthly_actual_by_project.get(project_id, 0) + hours
                
                # Create project allocation details with percentages for the month
                project_allocation_details = []
                all_project_ids = set(monthly_planned_by_project.keys()) | set(monthly_actual_by_project.keys())
                
                for project_id_iter in all_project_ids:
                    planned_hours = float(monthly_planned_by_project.get(project_id_iter, 0))
                    actual_hours = float(monthly_actual_by_project.get(project_id_iter, 0))
                    month_capacity_float = float(month_capacity)
                    
                    project_allocation_details.append({
                        "project_id": project_id_iter,
                        "project_name": project_names.get(project_id_iter, "Unknown Project"),
                        "planned_hours": round(planned_hours, 2),
                        "actual_hours": round(actual_hours, 2),
                        "planned_percentage": round((planned_hours / month_capacity_float * 100) if month_capacity_float > 0 else 0, 2),
                        "actual_percentage": round((actual_hours / month_capacity_float * 100) if month_capacity_float > 0 else 0, 2)
                    })

                # Add the monthly interval
                intervals.append({
                    "start_date": interval_start.strftime('%Y-%m-%d'),
                    "end_date": interval_end.strftime('%Y-%m-%d'),
                    "total_capacity": float(month_capacity),
                    "allocation_hours_planned": float(month_planned),
                    "allocation_hours_actual": float(month_actual),
                    "available_capacity": float(month_available),
                    "project_allocation_details": project_allocation_details
                })

        else:
            # Daily intervals (when interval is empty)
            for day in daily_data:
                # Create project allocation details
                project_allocation_details = []
                planned_by_project = day.get('planned_by_project', {})
                actual_by_project = day.get('actual_by_project', {})
                all_project_ids = set(planned_by_project.keys()) | set(actual_by_project.keys())
                
                for project_id_iter in all_project_ids:
                    planned_hours = float(planned_by_project.get(project_id_iter, 0))
                    actual_hours = float(actual_by_project.get(project_id_iter, 0))
                    capacity_float = float(day['total_capacity'])
                    
                    project_allocation_details.append({
                        "project_id": project_id_iter,
                        "project_name": project_names.get(project_id_iter, "Unknown Project"),
                        "planned_hours": round(planned_hours, 2),
                        "actual_hours": round(actual_hours, 2),
                        "planned_percentage": round((planned_hours / capacity_float * 100) if capacity_float > 0 else 0, 2),
                        "actual_percentage": round((actual_hours / capacity_float * 100) if capacity_float > 0 else 0, 2)
                    })
                
                intervals.append({
                    "start_date": day['date'],
                    "end_date": day['date'],
                    "total_capacity": float(day['total_capacity']),
                    "allocation_hours_planned": float(day['allocation_hours_planned']),
                    "allocation_hours_actual": float(day['allocation_hours_actual']),
                    "available_capacity": float(day['available_capacity']),
                    "project_allocation_details": project_allocation_details
                })
        
        # Apply block detection logic only when interval is empty
        if not interval or interval == '':
            # Block detection logic for empty intervals
            result = []
            if intervals:
                def values_changed(current, next_interval):
                    """Check if allocation details have changed"""
                    return current['project_allocation_details'] != next_interval['project_allocation_details']
                
                current_block_start = intervals[0]['start_date']
                current_block_intervals = [intervals[0]]
                
                for i, interval_data in enumerate(intervals[1:], 1):
                    if values_changed(intervals[i-1], interval_data):
                        # End current block and aggregate all intervals in the block
                        block_end = intervals[i-1]['end_date']
                        
                        # Aggregate all daily data in this block
                        block_total_capacity = sum(intv['total_capacity'] for intv in current_block_intervals)
                        block_planned = sum(intv['allocation_hours_planned'] for intv in current_block_intervals)
                        block_actual = sum(intv['allocation_hours_actual'] for intv in current_block_intervals)
                        block_available = sum(intv['available_capacity'] for intv in current_block_intervals)
                        
                        # Aggregate project details across all intervals in the block
                        project_aggregates = {}
                        for interval in current_block_intervals:
                            for project_detail in interval['project_allocation_details']:
                                project_id = project_detail['project_id']
                                if project_id not in project_aggregates:
                                    project_aggregates[project_id] = {
                                        'project_id': project_id,
                                        'project_name': project_detail['project_name'],
                                        'planned_hours': 0,
                                        'actual_hours': 0
                                    }
                                project_aggregates[project_id]['planned_hours'] += project_detail['planned_hours']
                                project_aggregates[project_id]['actual_hours'] += project_detail['actual_hours']
                        
                        # Create block project details with correct percentages
                        block_project_details = []
                        total_planned_from_projects = 0
                        total_actual_from_projects = 0
                        
                        for project_data in project_aggregates.values():
                            planned_rounded = round(project_data['planned_hours'], 1)
                            actual_rounded = round(project_data['actual_hours'], 1)
                            
                            scaled_project_detail = {
                                'project_id': project_data['project_id'],
                                'project_name': project_data['project_name'],
                                'planned_hours': planned_rounded,
                                'actual_hours': actual_rounded,
                                'planned_percentage': round((planned_rounded / block_total_capacity * 100) if block_total_capacity > 0 else 0, 2),
                                'actual_percentage': round((actual_rounded / block_total_capacity * 100) if block_total_capacity > 0 else 0, 2)
                            }
                            block_project_details.append(scaled_project_detail)
                            total_planned_from_projects += planned_rounded
                            total_actual_from_projects += actual_rounded
                        
                        # Use the sum of rounded project values for consistency
                        result.append({
                            "start_date": current_block_start,
                            "end_date": block_end,
                            "total_capacity": round(block_total_capacity, 1),
                            "allocation_hours_planned": round(total_planned_from_projects, 1),
                            "allocation_hours_actual": round(total_actual_from_projects, 1),
                            "available_capacity": round(block_total_capacity - total_planned_from_projects, 1),
                            "project_allocation_details": block_project_details
                        })
                        
                        # Start new block
                        current_block_start = interval_data['start_date']
                        current_block_intervals = [interval_data]
                    else:
                        # Continue current block
                        current_block_intervals.append(interval_data)
                
                # Add final block
                block_total_capacity = sum(intv['total_capacity'] for intv in current_block_intervals)
                block_planned = sum(intv['allocation_hours_planned'] for intv in current_block_intervals)
                block_actual = sum(intv['allocation_hours_actual'] for intv in current_block_intervals)
                block_available = sum(intv['available_capacity'] for intv in current_block_intervals)
                
                # Aggregate project details across all intervals in the final block
                final_project_aggregates = {}
                for interval in current_block_intervals:
                    for project_detail in interval['project_allocation_details']:
                        project_id = project_detail['project_id']
                        if project_id not in final_project_aggregates:
                            final_project_aggregates[project_id] = {
                                'project_id': project_id,
                                'project_name': project_detail['project_name'],
                                'planned_hours': 0,
                                'actual_hours': 0
                            }
                        final_project_aggregates[project_id]['planned_hours'] += project_detail['planned_hours']
                        final_project_aggregates[project_id]['actual_hours'] += project_detail['actual_hours']
                
                # Create final block project details with correct percentages
                final_block_project_details = []
                final_total_planned_from_projects = 0
                final_total_actual_from_projects = 0
                
                for project_data in final_project_aggregates.values():
                    planned_rounded = round(project_data['planned_hours'], 1)
                    actual_rounded = round(project_data['actual_hours'], 1)
                    
                    scaled_project_detail = {
                        'project_id': project_data['project_id'],
                        'project_name': project_data['project_name'],
                        'planned_hours': planned_rounded,
                        'actual_hours': actual_rounded,
                        'planned_percentage': round((planned_rounded / block_total_capacity * 100) if block_total_capacity > 0 else 0, 2),
                        'actual_percentage': round((actual_rounded / block_total_capacity * 100) if block_total_capacity > 0 else 0, 2)
                    }
                    final_block_project_details.append(scaled_project_detail)
                    final_total_planned_from_projects += planned_rounded
                    final_total_actual_from_projects += actual_rounded
                
                result.append({
                    "start_date": current_block_start,
                    "end_date": intervals[-1]['end_date'],
                    "total_capacity": round(block_total_capacity, 1),
                    "allocation_hours_planned": round(final_total_planned_from_projects, 1),
                    "allocation_hours_actual": round(final_total_actual_from_projects, 1),
                    "available_capacity": round(block_total_capacity - final_total_planned_from_projects, 1),
                    "project_allocation_details": final_block_project_details
                })
            else:
                result = []
        else:
            # For explicit intervals (Weekly/Monthly), return intervals as is
            result = intervals

        # --- Round only at the end ---
        def round_capacity_entry(entry):
            for k in entry:
                if k in [
                    "total_capacity", "total_capacity_cumulative",
                    "allocation_hours_planned", "allocation_hours_actual",
                    "available_capacity", "available_capacity_cumulative",
                    "cumulative_planned", "cumulative_actual"
                ] and isinstance(entry[k], float):
                    entry[k] = round(entry[k], 1)
            return entry
        result = [round_capacity_entry(entry) for entry in result]
        result = convert_decimal_to_float(result)
        
        # Create final response with resource details at top level
        response = {
            "resource_details": resource_details,
            "data": result
        }
        
        cursor.close()
        return JSONResponse(response, status_code=200)
    except psycopg2.Error as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    finally:
        if conn:
            release_pg_connection(conn)

# Retrieve resource capacity and allocation for a resource broken down by projects for a given time period and in weekly or monthly intervals
@resources_router.get('/resource_capacity_allocation_by_project')
async def resource_capacity_allocation_by_project_route(request: Request):
    resource_id = request.query_params.get('resource_id')
    start_date = request.query_params.get('start_date', f"{datetime.now().year}-01-01")
    end_date = request.query_params.get('end_date', f"{datetime.now().year}-12-31")
    interval = request.query_params.get('interval', 'Monthly')  # Default to Monthly
    return get_resource_capacity_allocation_by_project(resource_id, start_date, end_date, interval)

def get_resource_capacity_allocation_by_project(resource_id, start_date, end_date, interval):
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}, status_code=500)
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("""
            SELECT resource_id, resource_name, resource_email, resource_role, yearly_capacity, blended_rate
            FROM pmo.resources
            WHERE resource_id = %s
        """, (resource_id,))
        resource = cursor.fetchone()
        if not resource:
            return JSONResponse({"error": "Resource not found"}, status_code=404)
        yearly_capacity = float(resource['yearly_capacity'])
        blended_rate = float(resource['blended_rate'] or 0)
        daily_capacity = yearly_capacity / 261

        resource_details = {
            "resource_id": resource['resource_id'],
            "resource_name": resource['resource_name'],
            "resource_email": resource['resource_email'],
            "resource_role": resource['resource_role']
        }

        cursor.execute("""
            SELECT ra.project_id, p.project_name, ra.allocation_start_date, ra.allocation_end_date, 
                   ra.allocation_pct, ra.allocation_hrs_per_week
            FROM pmo.resource_allocation ra
            LEFT JOIN pmo.projects p ON ra.project_id = p.project_id
            WHERE ra.resource_id = %s
              AND ra.allocation_start_date <= %s
              AND ra.allocation_end_date >= %s
        """, (resource_id, end_date, start_date))
        allocations = [dict(row) for row in cursor.fetchall()]
        allocations = convert_decimal_to_float(allocations)

        cursor.execute("""
            SELECT te.project_id, p.project_name, te.ts_entry_date, SUM(te.ts_total_hrs) AS actual_hours
            FROM pmo.timesheet_entry te
            LEFT JOIN pmo.projects p ON te.project_id = p.project_id
            WHERE te.resource_id = %s
              AND te.ts_entry_date BETWEEN %s AND %s
            GROUP BY te.project_id, p.project_name, te.ts_entry_date
        """, (resource_id, start_date, end_date))
        actuals = [dict(row) for row in cursor.fetchall()]
        actuals = convert_decimal_to_float(actuals)

        actuals_map = {}
        project_names = {}
        for a in actuals:
            key = (a['project_id'], a['ts_entry_date'].strftime('%Y-%m-%d') if hasattr(a['ts_entry_date'], 'strftime') else str(a['ts_entry_date']))
            actuals_map[key] = float(a['actual_hours'])
            if a['project_id'] and a['project_name']:
                project_names[a['project_id']] = a['project_name']
        
        # Add project names from allocations
        for alloc in allocations:
            if alloc['project_id'] and alloc['project_name']:
                project_names[alloc['project_id']] = alloc['project_name']

        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        all_days = []
        cur = start_dt
        while cur <= end_dt:
            if cur.weekday() < 5:
                all_days.append(cur)
            cur += timedelta(days=1)

        allocations_by_project = {}
        for alloc in allocations:
            pid = alloc['project_id']
            allocations_by_project.setdefault(pid, []).append(alloc)

        # Build intervals (weeks: Mon-Sun, months: 1st-last)
        intervals = []
        if interval == "Weekly":
            cur = start_dt
            if cur.weekday() >= 5:
                days_to_monday = 7 - cur.weekday()
                cur = cur + timedelta(days=days_to_monday)
                if cur > end_dt:
                    intervals = []
            else:
                week_start = cur
                week_end = week_start + timedelta(days=(6 - week_start.weekday()))
                if week_end > end_dt:
                    week_end = end_dt
                intervals.append((week_start, week_end))
                cur = week_end + timedelta(days=1)
            while cur <= end_dt:
                week_start = cur
                week_end = week_start + timedelta(days=6)
                if week_end > end_dt:
                    week_end = end_dt
                intervals.append((week_start, week_end))
                cur = week_end + timedelta(days=1)
        else:
            # Monthly intervals: First uses user's start_date, middle use full months, last uses user's end_date
            # Determine all months that overlap with the date range
            months_to_process = []
            
            # Start with the month of start_dt
            current_month_start = start_dt.replace(day=1)
            
            while current_month_start <= end_dt:
                # Calculate month end (last day of current month)
                if current_month_start.month == 12:
                    next_month_start = current_month_start.replace(year=current_month_start.year + 1, month=1)
                else:
                    next_month_start = current_month_start.replace(month=current_month_start.month + 1)
                current_month_end = next_month_start - timedelta(days=1)
                
                months_to_process.append((current_month_start, current_month_end))
                current_month_start = next_month_start
            
            # Build intervals based on user's actual dates
            for i, (month_start, month_end) in enumerate(months_to_process):
                if len(months_to_process) == 1:
                    # Single month: use user's exact start and end dates
                    interval_start = start_dt
                    interval_end = end_dt
                elif i == 0:
                    # First month: start from user's start_date, end at month end or user's end_date
                    interval_start = start_dt 
                    interval_end = min(month_end, end_dt)
                elif i == len(months_to_process) - 1:
                    # Last month: start from month beginning, end at user's end_date
                    interval_start = month_start
                    interval_end = end_dt
                else:
                    # Middle months: use full calendar month
                    interval_start = month_start
                    interval_end = month_end
                
                intervals.append((interval_start, interval_end))

        # Build result: list of intervals, each with a list of projects
        result = {
            "resource_details": resource_details,
            "intervals": []
        }
        project_cumulatives = {}
        for idx, (intv_start, intv_end) in enumerate(intervals):
            interval_days = [d for d in all_days if intv_start <= d <= intv_end]
            total_capacity_this_interval = round(len(interval_days) * daily_capacity, 1)
            # Per-project planned/actual for this interval
            interval_project_data = {}
            for pid, project_allocs in allocations_by_project.items():
                planned = 0.0
                actual = 0.0
                for day in interval_days:
                    day_str = day.strftime('%Y-%m-%d')
                    day_planned = 0.0
                    for alloc in project_allocs:
                        alloc_start = alloc['allocation_start_date']
                        alloc_end = alloc['allocation_end_date']
                        if isinstance(alloc_start, str): alloc_start = datetime.strptime(alloc_start, "%Y-%m-%d").date()
                        if isinstance(alloc_end, str): alloc_end = datetime.strptime(alloc_end, "%Y-%m-%d").date()
                        if alloc_start <= day.date() <= alloc_end:
                            if alloc['allocation_hrs_per_week']:
                                day_planned += float(alloc['allocation_hrs_per_week']) / 5
                            else:
                                day_planned += daily_capacity * float(alloc.get('allocation_pct', 0) or 0) / 100
                    planned += day_planned
                    day_actual = actuals_map.get((pid, day_str), 0.0)
                    actual += day_actual
                interval_project_data[pid] = {"planned": planned, "actual": actual}
            # Used hours for this interval (sum actual if >0 else planned for each project)
            used = 0.0
            for pid, vals in interval_project_data.items():
                used += vals["actual"] if vals["actual"] > 0 else vals["planned"]
            # Clamp used to not exceed total_capacity_this_interval
            used = min(used, total_capacity_this_interval)
            # Now build project entries for this interval
            interval_obj = {
                "start_date": intv_start.strftime("%Y-%m-%d"),
                "end_date": intv_end.strftime("%Y-%m-%d"),
                "projects": []
            }
            for pid, vals in interval_project_data.items():
                planned = vals["planned"]
                actual = vals["actual"]
                # available cannot be more than total_capacity_this_interval and cannot be negative
                available = max(0.0, min(total_capacity_this_interval, round(total_capacity_this_interval - used, 1)))
                cost_planned = round(planned * blended_rate, 2)
                cost_actual = round(actual * blended_rate, 2)
                
                # Calculate percentages vs capacity
                planned_percentage = round((planned / total_capacity_this_interval * 100) if total_capacity_this_interval > 0 else 0, 2)
                actual_percentage = round((actual / total_capacity_this_interval * 100) if total_capacity_this_interval > 0 else 0, 2)
                
                if pid not in project_cumulatives:
                    project_cumulatives[pid] = {
                        "total_capacity": 0,
                        "planned": 0,
                        "actual": 0,
                        "available": 0,
                        "cost_planned": 0,
                        "cost_actual": 0
                    }
                project_cumulatives[pid]["total_capacity"] += total_capacity_this_interval
                project_cumulatives[pid]["planned"] += planned
                project_cumulatives[pid]["actual"] += actual
                project_cumulatives[pid]["available"] += available
                project_cumulatives[pid]["cost_planned"] += cost_planned
                project_cumulatives[pid]["cost_actual"] += cost_actual

                # Calculate cumulative percentages
                cumulative_planned_percentage = round((project_cumulatives[pid]["planned"] / project_cumulatives[pid]["total_capacity"] * 100) if project_cumulatives[pid]["total_capacity"] > 0 else 0, 2)
                cumulative_actual_percentage = round((project_cumulatives[pid]["actual"] / project_cumulatives[pid]["total_capacity"] * 100) if project_cumulatives[pid]["total_capacity"] > 0 else 0, 2)

                project_entry = {
                    "project_id": pid,
                    "project_name": project_names.get(pid, "Unknown Project"),
                    "total_capacity": float(round(total_capacity_this_interval, 1)),
                    "allocation_hours_planned": float(round(planned, 1)),
                    "allocation_hours_actual": float(round(actual, 1)),
                    "available_capacity": float(available),
                    "allocation_cost_planned": float(cost_planned),
                    "allocation_cost_actual": float(cost_actual),
                    "planned_percentage": planned_percentage,
                    "actual_percentage": actual_percentage,
                    "total_capacity_cumulative": float(round(project_cumulatives[pid]["total_capacity"], 1)),
                    "allocation_hours_planned_cumulative": float(round(project_cumulatives[pid]["planned"], 1)),
                    "allocation_hours_actual_cumulative": float(round(project_cumulatives[pid]["actual"], 1)),
                    "available_capacity_cumulative": float(round(project_cumulatives[pid]["available"], 1)),
                    "allocation_cost_planned_cumulative": float(round(project_cumulatives[pid]["cost_planned"], 2)),
                    "allocation_cost_actual_cumulative": float(round(project_cumulatives[pid]["cost_actual"], 2)),
                    "planned_percentage_cumulative": cumulative_planned_percentage,
                    "actual_percentage_cumulative": cumulative_actual_percentage
                }
                interval_obj["projects"].append(project_entry)
            result["intervals"].append(interval_obj)

        # Handle block-based logic when interval is empty
        if not interval or interval == '':
            # Convert intervals to blocks based on data changes
            block_data = []
            if result["intervals"]:
                # Flatten all project data by date for block analysis
                daily_project_data = {}
                
                # Create a comprehensive daily data structure
                for interval_obj in result["intervals"]:
                    interval_start = datetime.strptime(interval_obj.get("start_date", ""), "%Y-%m-%d")
                    interval_end = datetime.strptime(interval_obj.get("end_date", ""), "%Y-%m-%d")
                    
                    # Create daily entries for this interval period
                    current_date = interval_start
                    while current_date <= interval_end:
                        if current_date.weekday() < 5:  # Only weekdays
                            date_key = current_date.strftime('%Y-%m-%d')
                            daily_project_data[date_key] = interval_obj["projects"]
                        current_date += timedelta(days=1)
                
                # Group consecutive days with identical project data into blocks
                if daily_project_data:
                    sorted_dates = sorted(daily_project_data.keys())
                    current_block_start = sorted_dates[0]
                    current_block_projects = daily_project_data[sorted_dates[0]]
                    
                    for i, date in enumerate(sorted_dates[1:], 1):
                        # Compare project data to see if it's different
                        if daily_project_data[date] != current_block_projects:
                            # End current block
                            block_end = sorted_dates[i-1]
                            
                            # Calculate aggregated metrics for this block
                            total_capacity = sum(p.get('total_capacity', 0) for p in current_block_projects)
                            total_planned = sum(p.get('allocation_hours_planned', 0) for p in current_block_projects)
                            total_actual = sum(p.get('allocation_hours_actual', 0) for p in current_block_projects)
                            total_available = sum(p.get('available_capacity', 0) for p in current_block_projects)
                            total_cost_planned = sum(p.get('allocation_cost_planned', 0) for p in current_block_projects)
                            total_cost_actual = sum(p.get('allocation_cost_actual', 0) for p in current_block_projects)
                            
                            block_data.append({
                                "start_date": current_block_start,
                                "end_date": block_end,
                                "total_capacity": round(total_capacity, 1),
                                "allocation_hours_planned": round(total_planned, 1),
                                "allocation_hours_actual": round(total_actual, 1),
                                "available_capacity": round(total_available, 1),
                                "allocation_cost_planned": round(total_cost_planned, 2),
                                "allocation_cost_actual": round(total_cost_actual, 2),
                                "projects": current_block_projects
                            })
                            
                            # Start new block
                            current_block_start = date
                            current_block_projects = daily_project_data[date]
                    
                    # Add the final block
                    block_end = sorted_dates[-1]
                    total_capacity = sum(p.get('total_capacity', 0) for p in current_block_projects)
                    total_planned = sum(p.get('allocation_hours_planned', 0) for p in current_block_projects)
                    total_actual = sum(p.get('allocation_hours_actual', 0) for p in current_block_projects)
                    total_available = sum(p.get('available_capacity', 0) for p in current_block_projects)
                    total_cost_planned = sum(p.get('allocation_cost_planned', 0) for p in current_block_projects)
                    total_cost_actual = sum(p.get('allocation_cost_actual', 0) for p in current_block_projects)
                    
                    block_data.append({
                        "start_date": current_block_start,
                        "end_date": block_end,
                        "total_capacity": round(total_capacity, 1),
                        "allocation_hours_planned": round(total_planned, 1),
                        "allocation_hours_actual": round(total_actual, 1),
                        "available_capacity": round(total_available, 1),
                        "allocation_cost_planned": round(total_cost_planned, 2),
                        "allocation_cost_actual": round(total_cost_actual, 2),
                        "projects": current_block_projects
                    })
                
                # Replace the intervals structure with blocks
                result = {
                    "resource_details": result["resource_details"],
                    "blocks": block_data
                }

        cursor.close()
        return JSONResponse(convert_decimal_to_float(result), status_code=200)
    except psycopg2.Error as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    finally:
        if conn:
            release_pg_connection(conn)

# Retrieve resource capacity allocation for a specific project
@resources_router.get('/project_capacity_allocation/{project_id}')
async def get_project_capacity_allocation(request: Request, project_id: int):
    interval = request.query_params.get('interval', 'Monthly')  # Default to Monthly
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    allocations_response = get_allocations_by_project(project_ids=[project_id])
    if not allocations_response or allocations_response.status_code != 200:
        return JSONResponse(content=[], status_code=200)
    try:
        allocations_data = json.loads(allocations_response.body.decode("utf-8"))
    except (json.JSONDecodeError, AttributeError) as e:
        print(f"Error decoding allocations_response: {e}")
        return JSONResponse(content=[], status_code=200)
    if not allocations_data:
        return JSONResponse(content=[], status_code=200)
    resource_ids = list({allocation['resource_id'] for allocation in allocations_data})
    
    # Extract project information from allocations data
    project_info = {
        "project_name": allocations_data[0].get('project_name', 'Unknown Project'),
        "project_strategic_portfolio": allocations_data[0].get('project_strategic_portfolio', 'Unknown Portfolio'),
        "project_product_line": allocations_data[0].get('project_product_line', 'Unknown Product Line')
    }
    
    # Use provided dates or fall back to allocation dates
    start_date_est = start_date if start_date else allocations_data[0]['start_date_est']
    end_date_est = end_date if end_date else allocations_data[0]['end_date_est']
    aggregated_data = {}

    # --- Parallelize resource calls ---
    from concurrent.futures import ThreadPoolExecutor
    import asyncio

    async def fetch_resource_capacity(resource_id):
        # Call the endpoint without project_id filter to get all capacity data
        # We'll filter the project data afterward to preserve all time periods
        return resource_id, await get_resource_capacity_allocation_route(
            resource_id=str(resource_id), 
            start_date=start_date_est, 
            end_date=end_date_est, 
            interval=interval,
            project_id=None  # Don't filter at DB level - we'll filter afterward
        )

    # Create tasks for async execution
    tasks = [fetch_resource_capacity(resource_id) for resource_id in resource_ids]
    
    # Execute all tasks concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    for result in results:
        if isinstance(result, Exception):
            print(f"Error in fetch_resource_capacity: {result}")
            continue
        
        resource_id, resource_capacity_data = result
        if resource_capacity_data.status_code != 200:
            continue
        
        # Handle the new resource_capacity_allocation endpoint response
        try:
            resource_capacity = json.loads(resource_capacity_data.body.decode("utf-8"))
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"Error decoding resource_capacity_data: {e}")
            continue
        
        # Handle empty response (resource not allocated to project)
        if isinstance(resource_capacity, list) and len(resource_capacity) == 0:
            continue
            
        # Handle the new structure: {"resource_details": {...}, "data": [...]}
        if isinstance(resource_capacity, dict) and 'data' in resource_capacity:
            intervals_data = resource_capacity['data']
            resource_details_from_response = resource_capacity.get('resource_details', {})
        else:
            continue  # Unexpected structure
        
        for interval_obj in intervals_data:
            period_key = interval_obj.get('start_date', '')
            
            # Extract project allocation details for this interval
            project_allocation_details = interval_obj.get('project_allocation_details', [])
            
            # Filter for the specific project_id we're interested in
            project_details_for_this_project = [
                detail for detail in project_allocation_details 
                if detail.get('project_id') == project_id
            ]
            
            # Initialize aggregated data for this period (even if no allocations for this project)
            if period_key not in aggregated_data:
                aggregated_data[period_key] = {
                    'start_date': interval_obj.get('start_date'),
                    'end_date': interval_obj.get('end_date'),
                    'total_capacity': 0,
                    'allocation_hours_planned': 0,
                    'allocation_hours_actual': 0,
                    'available_capacity': 0,
                    'allocation_cost_planned': 0,
                    'allocation_cost_actual': 0,
                    'resource_details': []
                }
            
            # Add interval-level capacity data (always add total capacity)
            aggregated_data[period_key]['total_capacity'] += interval_obj.get('total_capacity', 0)
            aggregated_data[period_key]['available_capacity'] += interval_obj.get('available_capacity', 0)
            
            # Process project-specific allocations (if any exist for this project)
            if project_details_for_this_project:
                project_detail = project_details_for_this_project[0]  # Should be only one since we filtered by project
                
                # Add project-specific allocation data
                planned_hours = project_detail.get('planned_hours', 0)
                actual_hours = project_detail.get('actual_hours', 0)
                aggregated_data[period_key]['allocation_hours_planned'] += planned_hours
                aggregated_data[period_key]['allocation_hours_actual'] += actual_hours
                
                # Calculate cost
                planned_cost = planned_hours * 48  # Default rate
                actual_cost = actual_hours * 48
                aggregated_data[period_key]['allocation_cost_planned'] += planned_cost
                aggregated_data[period_key]['allocation_cost_actual'] += actual_cost
                
                # Create resource detail entry with minimal fields to match original format
                if resource_details_from_response and resource_details_from_response.get("resource_id") is not None:
                    detail = {
                        "resource_id": resource_details_from_response.get("resource_id"),
                        "resource_name": resource_details_from_response.get("resource_name"),
                        "resource_email": resource_details_from_response.get("resource_email"),
                        "resource_role": resource_details_from_response.get("resource_role"),
                        "total_capacity": interval_obj.get('total_capacity', 0),
                        "allocation_hours_planned": planned_hours,
                        "allocation_hours_actual": actual_hours,
                        "available_capacity": interval_obj.get('available_capacity', 0),
                        "allocation_cost_planned": planned_cost,
                        "allocation_cost_actual": actual_cost
                    }
                    aggregated_data[period_key]['resource_details'].append(detail)
            else:
                # No allocations for this project in this period, but still add resource capacity info
                if resource_details_from_response and resource_details_from_response.get("resource_id") is not None:
                    detail = {
                        "resource_id": resource_details_from_response.get("resource_id"),
                        "resource_name": resource_details_from_response.get("resource_name"),
                        "resource_email": resource_details_from_response.get("resource_email"),
                        "resource_role": resource_details_from_response.get("resource_role"),
                        "total_capacity": interval_obj.get('total_capacity', 0),
                        "allocation_hours_planned": 0,
                        "allocation_hours_actual": 0,
                        "available_capacity": interval_obj.get('available_capacity', 0),
                        "allocation_cost_planned": 0,
                        "allocation_cost_actual": 0
                    }
                    aggregated_data[period_key]['resource_details'].append(detail)

    # Convert aggregated_data to intervals list (sorted by period key) and calculate cumulatives
    intervals = []
    cumulative_totals = {
        'total_capacity': 0,
        'allocation_hours_planned': 0,
        'allocation_hours_actual': 0,
        'available_capacity': 0,
        'allocation_cost_planned': 0,
        'allocation_cost_actual': 0
    }
    
    # Group cumulative totals by resource for proper cumulative calculations
    resource_cumulatives = {}
    
    for period_key in sorted(aggregated_data.keys()):
        interval_data = aggregated_data[period_key]
        
        # Update grand totals
        cumulative_totals['total_capacity'] += interval_data.get('total_capacity', 0)
        cumulative_totals['allocation_hours_planned'] += interval_data.get('allocation_hours_planned', 0)
        cumulative_totals['allocation_hours_actual'] += interval_data.get('allocation_hours_actual', 0)
        cumulative_totals['available_capacity'] += interval_data.get('available_capacity', 0)
        cumulative_totals['allocation_cost_planned'] += interval_data.get('allocation_cost_planned', 0)
        cumulative_totals['allocation_cost_actual'] += interval_data.get('allocation_cost_actual', 0)
        
        # Update resource details with cumulative calculations
        updated_resource_details = []
        for resource_detail in interval_data.get('resource_details', []):
            resource_id = resource_detail.get('resource_id')
            
            # Initialize cumulative tracking for this resource if not exists
            if resource_id not in resource_cumulatives:
                resource_cumulatives[resource_id] = {
                    'total_capacity_cumulative': 0,
                    'allocation_hours_planned_cumulative': 0,
                    'allocation_hours_actual_cumulative': 0,
                    'available_capacity_cumulative': 0,
                    'allocation_cost_planned_cumulative': 0,
                    'allocation_cost_actual_cumulative': 0
                }
            
            # Update resource cumulatives
            resource_cumulatives[resource_id]['total_capacity_cumulative'] += resource_detail.get('total_capacity', 0)
            resource_cumulatives[resource_id]['allocation_hours_planned_cumulative'] += resource_detail.get('allocation_hours_planned', 0)
            resource_cumulatives[resource_id]['allocation_hours_actual_cumulative'] += resource_detail.get('allocation_hours_actual', 0)
            resource_cumulatives[resource_id]['available_capacity_cumulative'] += resource_detail.get('available_capacity', 0)
            resource_cumulatives[resource_id]['allocation_cost_planned_cumulative'] += resource_detail.get('allocation_cost_planned', 0)
            resource_cumulatives[resource_id]['allocation_cost_actual_cumulative'] += resource_detail.get('allocation_cost_actual', 0)
            
            # Add cumulative fields to the resource detail and round all values
            updated_detail = {
                "resource_id": resource_detail.get('resource_id'),
                "resource_name": resource_detail.get('resource_name'),
                "resource_email": resource_detail.get('resource_email'),
                "resource_role": resource_detail.get('resource_role'),
                "total_capacity": round(resource_detail.get('total_capacity', 0), 1),
                "allocation_hours_planned": round(resource_detail.get('allocation_hours_planned', 0), 1),
                "allocation_hours_actual": round(resource_detail.get('allocation_hours_actual', 0), 1),
                "available_capacity": round(resource_detail.get('available_capacity', 0), 1),
                "allocation_cost_planned": round(resource_detail.get('allocation_cost_planned', 0), 2),
                "allocation_cost_actual": round(resource_detail.get('allocation_cost_actual', 0), 2),
                "total_capacity_cumulative": round(resource_cumulatives[resource_id]['total_capacity_cumulative'], 1),
                "allocation_hours_planned_cumulative": round(resource_cumulatives[resource_id]['allocation_hours_planned_cumulative'], 1),
                "allocation_hours_actual_cumulative": round(resource_cumulatives[resource_id]['allocation_hours_actual_cumulative'], 1),
                "available_capacity_cumulative": round(resource_cumulatives[resource_id]['available_capacity_cumulative'], 1),
                "allocation_cost_planned_cumulative": round(resource_cumulatives[resource_id]['allocation_cost_planned_cumulative'], 2),
                "allocation_cost_actual_cumulative": round(resource_cumulatives[resource_id]['allocation_cost_actual_cumulative'], 2)
            }
            updated_resource_details.append(updated_detail)
        
        intervals.append({
            "start_date": interval_data.get('start_date'),
            "end_date": interval_data.get('end_date'),
            "total_capacity": round(interval_data.get('total_capacity', 0), 1),
            "allocation_hours_planned": round(interval_data.get('allocation_hours_planned', 0), 1),
            "allocation_hours_actual": round(interval_data.get('allocation_hours_actual', 0), 1),
            "available_capacity": round(interval_data.get('available_capacity', 0), 1),
            "allocation_cost_planned": round(interval_data.get('allocation_cost_planned', 0), 2),
            "allocation_cost_actual": round(interval_data.get('allocation_cost_actual', 0), 2),
            "total_capacity_cumulative": round(cumulative_totals['total_capacity'], 1),
            "allocation_hours_planned_cumulative": round(cumulative_totals['allocation_hours_planned'], 1),
            "allocation_hours_actual_cumulative": round(cumulative_totals['allocation_hours_actual'], 1),
            "available_capacity_cumulative": round(cumulative_totals['available_capacity'], 1),
            "allocation_cost_planned_cumulative": round(cumulative_totals['allocation_cost_planned'], 2),
            "allocation_cost_actual_cumulative": round(cumulative_totals['allocation_cost_actual'], 2),
            "resource_details": updated_resource_details
        })

    # Handle block-based logic when interval is empty
    if not interval or interval == '':
        # Data is already in block format, just restructure it for response
        block_data = []
        if intervals:
            for interval_data in intervals:
                # Data is already aggregated by block
                block_data.append({
                    "start_date": interval_data.get('start_date'),
                    "end_date": interval_data.get('end_date'),
                    "total_capacity": round(interval_data.get('total_capacity', 0), 1),
                    "allocation_hours_planned": round(interval_data.get('allocation_hours_planned', 0), 1),
                    "allocation_hours_actual": round(interval_data.get('allocation_hours_actual', 0), 1),
                    "available_capacity": round(interval_data.get('available_capacity', 0), 1),
                    "allocation_cost_planned": round(interval_data.get('allocation_cost_planned', 0), 2),
                    "allocation_cost_actual": round(interval_data.get('allocation_cost_actual', 0), 2),
                    "resource_details": interval_data.get('resource_details', [])
                })
        
        # Calculate grand totals for blocks
        grand_total_capacity = sum(block['total_capacity'] for block in block_data)
        grand_total_allocation_hours_planned = sum(block['allocation_hours_planned'] for block in block_data)
        grand_total_allocation_hours_actual = sum(block['allocation_hours_actual'] for block in block_data)
        grand_total_available_capacity = sum(block['available_capacity'] for block in block_data)
        
        response = {
            "project_id": int(project_id),
            "project_name": project_info["project_name"],
            "project_strategic_portfolio": project_info["project_strategic_portfolio"],
            "project_product_line": project_info["project_product_line"],
            "start_date_est": start_date_est,
            "end_date_est": end_date_est,
            "grand_total_capacity": round(grand_total_capacity, 1),
            "grand_total_allocation_hours_planned": round(grand_total_allocation_hours_planned, 1),
            "grand_total_allocation_hours_actual": round(grand_total_allocation_hours_actual, 1),
            "grand_total_available_capacity": round(grand_total_available_capacity, 1),
            "blocks": block_data
        }
    else:
        # --- Grand totals at the top ---
        grand_total_capacity = sum(i['total_capacity'] for i in intervals)
        grand_total_allocation_hours_planned = sum(i['allocation_hours_planned'] for i in intervals)
        grand_total_allocation_hours_actual = sum(i['allocation_hours_actual'] for i in intervals)
        grand_total_available_capacity = sum(i['available_capacity'] for i in intervals)

        response = {
            "project_id": int(project_id),
            "project_name": project_info["project_name"],
            "project_strategic_portfolio": project_info["project_strategic_portfolio"],
            "project_product_line": project_info["project_product_line"],
            "start_date_est": start_date_est,
            "end_date_est": end_date_est,
            "grand_total_capacity": round(grand_total_capacity, 1),
            "grand_total_allocation_hours_planned": round(grand_total_allocation_hours_planned, 1),
            "grand_total_allocation_hours_actual": round(grand_total_allocation_hours_actual, 1),
            "grand_total_available_capacity": round(grand_total_available_capacity, 1),
            "intervals": intervals
        }
        
    return JSONResponse(content=response, status_code=200)

def round_numeric_values(data):
    """
    Recursively round all numeric values in a dictionary or list to 1 decimal place.
    """
    if isinstance(data, list):
        return [round_numeric_values(item) for item in data]
    elif isinstance(data, dict):
        return {key: (round(value, 1) if isinstance(value, (float, int)) else round_numeric_values(value))
                for key, value in data.items()}
    return data

# PATCH: New endpoint for resource capacity/allocation per portfolio
@resources_router.get('/resource_capacity_allocation_per_portfolio')
async def resource_capacity_allocation_per_portfolio(
    strategic_portfolio: str = Query(None, description="Strategic Portfolio (optional)"),
    product_line: str = Query(None, description="Product Line (optional)"),
    start_date: str = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(None, description="End date (YYYY-MM-DD)"),
    interval: str = Query("Monthly", description="Interval: Weekly, Monthly, or empty for blocks")
):
    """
    Retrieve resource capacity and allocation (planned and actual) for all resources filtered by portfolio and/or product line.
    """
    # Set default dates and interval if not provided
    today = date.today()
    if not start_date:
        start_date = f"{today.year}-01-01"
    if not end_date:
        end_date = f"{today.year}-12-31"
    if not interval:
        interval = "Monthly"
        end_date = f"{today.year}-12-31"

    # Get all resources from the /resources API
    all_resources_resp = get_resources()
    if hasattr(all_resources_resp, "body"):
        all_resources = json.loads(all_resources_resp.body.decode("utf-8"))
    else:
        all_resources = all_resources_resp

    # Filter resources by strategic_portfolio and product_line if provided
    filtered_resources = []
    for r in all_resources:
        match = True
        if strategic_portfolio:
            match = match and (r.get("strategic_portfolio") == strategic_portfolio)
        if product_line:
            match = match and (r.get("product_line") == product_line)
        if match:
            filtered_resources.append(r)

    if not filtered_resources:
        return JSONResponse({"error": "No resources found for given filters"}, status_code=404)

    resource_ids = [r['resource_id'] for r in filtered_resources]

    # Use ThreadPoolExecutor to call get_resource_capacity_allocation_route in parallel
    from concurrent.futures import ThreadPoolExecutor
    import asyncio

    async def fetch_resource(resource_id):
        response = await get_resource_capacity_allocation_route(
            resource_id=str(resource_id),
            start_date=start_date,
            end_date=end_date,
            interval=interval,
            project_id=None
        )
        # Extract the actual content from JSONResponse
        if hasattr(response, 'body'):
            return resource_id, response
        else:
            # If it's already the content, wrap it in a response-like object
            return resource_id, type('MockResponse', (), {'body': json.dumps(response).encode('utf-8'), 'status_code': 200})()

    loop = asyncio.get_event_loop()
    tasks = [fetch_resource(rid) for rid in resource_ids]
    responses = await asyncio.gather(*tasks, return_exceptions=True)

    # Aggregate results and collect resource details
    interval_map = {}
    resource_details_map = {}
    
    for result in responses:
        if isinstance(result, Exception):
            print(f"Error in fetch_resource: {result}")
            continue
        
        resource_id, resp = result
        
        if hasattr(resp, "body"):
            try:
                response_data = json.loads(resp.body.decode("utf-8"))
            except Exception as e:
                print(f"Error decoding response for resource {resource_id}: {e}")
                response_data = {"data": []}
        else:
            response_data = resp
        
        # Handle error responses - skip resources with errors but don't fail the whole request
        if isinstance(response_data, dict) and "error" in response_data:
            continue
            
        if isinstance(response_data, dict) and "resource_details" in response_data:
            resource_details_map[resource_id] = response_data["resource_details"]
            data = response_data["data"]
        else:
            # Fallback for old response format (direct array)
            data = response_data if isinstance(response_data, list) else []
            
        for period in data:
            # Use start_date as the interval key for both Weekly and Monthly
            interval_key = period.get('start_date')
            if not interval_key:
                continue
            if interval_key not in interval_map:
                interval_map[interval_key] = {
                    "interval": interval_key,
                    "total_capacity": 0,
                    "allocation_hours_planned": 0,
                    "allocation_hours_actual": 0,
                    "available_capacity": 0,
                    "resources": []
                }
            
            # Add to aggregated totals
            interval_map[interval_key]["total_capacity"] += period.get("total_capacity", 0)
            interval_map[interval_key]["allocation_hours_planned"] += period.get("allocation_hours_planned", 0)
            interval_map[interval_key]["allocation_hours_actual"] += period.get("allocation_hours_actual", 0)
            interval_map[interval_key]["available_capacity"] += period.get("available_capacity", 0)
            
            # Add resource-level details
            resource_detail = resource_details_map.get(resource_id, {})
            resource_period_data = {
                "resource_id": resource_id,
                "resource_name": resource_detail.get("resource_name", f"Resource {resource_id}"),
                "resource_role": resource_detail.get("resource_role", "Unknown"),
                "strategic_portfolio": resource_detail.get("strategic_portfolio", "Unknown"),
                "product_line": resource_detail.get("product_line", "Unknown"),
                "total_capacity": period.get("total_capacity", 0),
                "allocation_hours_planned": period.get("allocation_hours_planned", 0),
                "allocation_hours_actual": period.get("allocation_hours_actual", 0),
                "available_capacity": period.get("available_capacity", 0),
                "project_allocation_details": period.get("project_allocation_details", [])
            }
            interval_map[interval_key]["resources"].append(resource_period_data)

    def round1(x):
        if isinstance(x, float):
            return round(x, 1)
        if isinstance(x, dict):
            return {k: round1(v) for k, v in x.items()}
        if isinstance(x, list):
            return [round1(v) for v in x]
        return x

    sorted_intervals = sorted(interval_map.keys())
    response_intervals = [round1(interval_map[k]) for k in sorted_intervals]

    # Handle block-based logic when interval is empty
    if not interval or interval == '':
        # Convert intervals to blocks based on data changes
        block_data = []
        if response_intervals:
            current_block_start = None
            current_block_data = None
            
            for i, interval_data in enumerate(response_intervals):
                current_date = interval_data.get('interval', '')
                
                # Create comparable data structure
                comparable_data = {
                    'total_capacity': interval_data.get('total_capacity', 0),
                    'allocation_hours_planned': interval_data.get('allocation_hours_planned', 0),
                    'allocation_hours_actual': interval_data.get('allocation_hours_actual', 0),
                    'available_capacity': interval_data.get('available_capacity', 0)
                }
                
                if current_block_data is None:
                    # Start first block
                    current_block_start = current_date
                    current_block_data = comparable_data
                elif comparable_data != current_block_data:
                    # End current block and start new one
                    prev_date = response_intervals[i-1].get('interval', '')
                    
                    # Calculate block end date
                    if interval == 'Weekly':
                        # For weekly, add 6 days to get end of week
                        block_end = (datetime.strptime(prev_date, '%Y-%m-%d') + timedelta(days=6)).strftime('%Y-%m-%d')
                    else:
                        # For monthly, calculate end of month
                        year, month, day = prev_date.split('-')
                        next_month = datetime(int(year), int(month), 1) + timedelta(days=32)
                        block_end = (next_month.replace(day=1) - timedelta(days=1)).strftime('%Y-%m-%d')
                    
                    block_data.append({
                        "start_date": current_block_start,
                        "end_date": block_end,
                        "total_capacity": round(current_block_data['total_capacity'], 1),
                        "allocation_hours_planned": round(current_block_data['allocation_hours_planned'], 1),
                        "allocation_hours_actual": round(current_block_data['allocation_hours_actual'], 1),
                        "available_capacity": round(current_block_data['available_capacity'], 1)
                    })
                    
                    # Start new block
                    current_block_start = current_date
                    current_block_data = comparable_data
            
            # Add final block
            if current_block_data is not None:
                final_date = response_intervals[-1].get('interval', '')
                
                # Calculate final block end date
                if interval == 'Weekly':
                    block_end = (datetime.strptime(final_date, '%Y-%m-%d') + timedelta(days=6)).strftime('%Y-%m-%d')
                else:
                    year, month, day = final_date.split('-')
                    next_month = datetime(int(year), int(month), 1) + timedelta(days=32)
                    block_end = (next_month.replace(day=1) - timedelta(days=1)).strftime('%Y-%m-%d')
                
                block_data.append({
                    "start_date": current_block_start,
                    "end_date": block_end,
                    "total_capacity": round(current_block_data['total_capacity'], 1),
                    "allocation_hours_planned": round(current_block_data['allocation_hours_planned'], 1),
                    "allocation_hours_actual": round(current_block_data['allocation_hours_actual'], 1),
                    "available_capacity": round(current_block_data['available_capacity'], 1)
                })
        
        # Calculate grand totals for blocks
        grand_total_capacity = sum(block['total_capacity'] for block in block_data)
        grand_total_allocation_hours_planned = sum(block['allocation_hours_planned'] for block in block_data)
        grand_total_allocation_hours_actual = sum(block['allocation_hours_actual'] for block in block_data)
        grand_total_available_capacity = sum(block['available_capacity'] for block in block_data)
        
        # Calculate resource-level aggregates for blocks
        resource_aggregates = {}
        for interval_data in response_intervals:
            for resource in interval_data.get("resources", []):
                rid = resource["resource_id"]
                if rid not in resource_aggregates:
                    resource_aggregates[rid] = {
                        "resource_id": rid,
                        "resource_name": resource["resource_name"],
                        "resource_role": resource["resource_role"],
                        "strategic_portfolio": resource["strategic_portfolio"],
                        "product_line": resource["product_line"],
                        "total_capacity": 0,
                        "allocation_hours_planned": 0,
                        "allocation_hours_actual": 0,
                        "available_capacity": 0
                    }
                resource_aggregates[rid]["total_capacity"] += resource["total_capacity"]
                resource_aggregates[rid]["allocation_hours_planned"] += resource["allocation_hours_planned"]
                resource_aggregates[rid]["allocation_hours_actual"] += resource["allocation_hours_actual"]
                resource_aggregates[rid]["available_capacity"] += resource["available_capacity"]
        
        response = {
            "strategic_portfolio": strategic_portfolio,
            "product_line": product_line,
            "grand_total_capacity": round(grand_total_capacity, 1),
            "grand_total_allocation_hours_planned": round(grand_total_allocation_hours_planned, 1),
            "grand_total_allocation_hours_actual": round(grand_total_allocation_hours_actual, 1),
            "grand_total_available_capacity": round(grand_total_available_capacity, 1),
            "resource_summary": [round1(resource) for resource in resource_aggregates.values()],
            "blocks": block_data
        }
    else:
        # Original interval-based logic
        grand_total_capacity = sum(interval["total_capacity"] for interval in response_intervals)
        grand_total_allocation_hours_planned = sum(interval["allocation_hours_planned"] for interval in response_intervals)
        grand_total_allocation_hours_actual = sum(interval["allocation_hours_actual"] for interval in response_intervals)
        grand_total_available_capacity = sum(interval["available_capacity"] for interval in response_intervals)

        # Calculate resource-level aggregates
        resource_aggregates = {}
        for interval_data in response_intervals:
            for resource in interval_data.get("resources", []):
                rid = resource["resource_id"]
                if rid not in resource_aggregates:
                    resource_aggregates[rid] = {
                        "resource_id": rid,
                        "resource_name": resource["resource_name"],
                        "resource_role": resource["resource_role"],
                        "strategic_portfolio": resource["strategic_portfolio"],
                        "product_line": resource["product_line"],
                        "total_capacity": 0,
                        "allocation_hours_planned": 0,
                        "allocation_hours_actual": 0,
                        "available_capacity": 0
                    }
                resource_aggregates[rid]["total_capacity"] += resource["total_capacity"]
                resource_aggregates[rid]["allocation_hours_planned"] += resource["allocation_hours_planned"]
                resource_aggregates[rid]["allocation_hours_actual"] += resource["allocation_hours_actual"]
                resource_aggregates[rid]["available_capacity"] += resource["available_capacity"]

        response = {
            "strategic_portfolio": strategic_portfolio,
            "product_line": product_line,
            "grand_total_capacity": round(grand_total_capacity, 1),
            "grand_total_allocation_hours_planned": round(grand_total_allocation_hours_planned, 1),
            "grand_total_allocation_hours_actual": round(grand_total_allocation_hours_actual, 1),
            "grand_total_available_capacity": round(grand_total_available_capacity, 1),
            "resource_summary": [round1(resource) for resource in resource_aggregates.values()],
            "intervals": response_intervals
        }

    return JSONResponse(content=response, status_code=200)