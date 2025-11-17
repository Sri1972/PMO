from fastapi import APIRouter, HTTPException
from db_utils_pg import get_pg_connection, release_pg_connection
import psycopg2
from psycopg2.extras import DictCursor

roles_router = APIRouter()

######################################################################
#      Resource Related Operations
######################################################################

# Retrieve all Resource Roles
@roles_router.get('/resource_roles')
def get_roles():
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("SELECT * FROM pmo.resource_roles")
        roles = cursor.fetchall()

        # Convert rows to a list of dictionaries
        roles = [dict(role) for role in roles]

        cursor.close()
        return roles  # Return as JSON
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn:
            release_pg_connection(conn)