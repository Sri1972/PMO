# managers.py
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from db_utils_pg import get_pg_connection, release_pg_connection
import psycopg2
from psycopg2.extras import DictCursor

managers_router = APIRouter()

######################################################################
#      MANAGERS Related Operations
######################################################################

# Retrieve all managers
@managers_router.get('/managers')
def get_managers():
    conn = get_pg_connection()
    if conn is None:
        return JSONResponse({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute(
            "SELECT manager_name, manager_email, strategic_portfolio FROM pmo.managers ORDER BY manager_name")
        managers = cursor.fetchall()

        # Convert rows to a list of dictionaries
        managers = [dict(manager) for manager in managers]

        cursor.close()
        return JSONResponse(content=managers)  # Return as JSON
    except psycopg2.Error as e:
        print(f"Error during retrieval of managers: {e}")  # Log the error during retrieval
        return JSONResponse({"error": str(e)}), 400
    finally:
        if conn:
            release_pg_connection(conn)