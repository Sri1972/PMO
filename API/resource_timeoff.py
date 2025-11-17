from fastapi import APIRouter, HTTPException
from db_utils_pg import get_pg_connection, release_pg_connection
import psycopg2
from psycopg2.extras import DictCursor

timeoff_router = APIRouter()

######################################################################
#      RESOURCE TIMEOFF Related Operations
######################################################################

# Retrieve time off for all resources
@timeoff_router.get('/timeoff')
def get_timeoff():
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("""
            SELECT t.resource_id AS resource_id, r.resource_name AS resource_name, 
                   DATE(timeoff_start_date) AS timeoff_start_date, 
                   DATE(timeoff_end_date) AS timeoff_end_date, reason 
            FROM pmo.timeoff t
            JOIN pmo.resources r ON t.resource_id = r.resource_id
        """)
        timeoff = cursor.fetchall()

        # Convert rows to a list of dictionaries
        timeoff = [dict(t) for t in timeoff]

        # Format dates to remove timestamps
        for t in timeoff:
            if t['timeoff_start_date']:
                t['timeoff_start_date'] = t['timeoff_start_date'].strftime('%Y-%m-%d')
            if t['timeoff_end_date']:
                t['timeoff_end_date'] = t['timeoff_end_date'].strftime('%Y-%m-%d')

        cursor.close()
        return timeoff
    except psycopg2.Error as e:
        print(f"Error during retrieval of time off: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn:
            release_pg_connection(conn)

# Retrieve time off for a specific resource
@timeoff_router.get('/timeoff/{resource_id}')
def get_timeoff_by_resource(resource_id: int):
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("""
            SELECT t.resource_id AS resource_id, r.resource_name AS resource_name, 
                   DATE(timeoff_start_date) AS timeoff_start_date, 
                   DATE(timeoff_end_date) AS timeoff_end_date, reason 
            FROM pmo.timeoff t
            JOIN pmo.resources r ON t.resource_id = r.resource_id 
            WHERE t.resource_id = %s
        """, (resource_id,))
        timeoff = cursor.fetchall()

        # Convert rows to a list of dictionaries
        timeoff = [dict(t) for t in timeoff]

        # Format dates to remove timestamps
        for t in timeoff:
            if t['timeoff_start_date']:
                t['timeoff_start_date'] = t['timeoff_start_date'].strftime('%Y-%m-%d')
            if t['timeoff_end_date']:
                t['timeoff_end_date'] = t['timeoff_end_date'].strftime('%Y-%m-%d')

        cursor.close()
        return timeoff
    except psycopg2.Error as e:
        print(f"Error during retrieval of time off: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn:
            release_pg_connection(conn)

# Add time off for a specific resource
@timeoff_router.post('/timeoff')
def add_timeoff(data: dict):
    print(f"Received data for time off: {data}")  # Log received data
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO pmo.timeoff (resource_id, timeoff_start_date, timeoff_end_date, reason)
            VALUES (%s, %s, %s, %s)
        """, (data['resource_id'], data['timeoff_start_date'], data['timeoff_end_date'], data['reason']))
        conn.commit()
        return {"message": "Time off added successfully"}
    except psycopg2.Error as e:
        print(f"Error during insert operation: {e}")  # Log the error during insert
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn:
            release_pg_connection(conn)