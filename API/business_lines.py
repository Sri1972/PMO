from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from db_utils_pg import get_pg_connection, release_pg_connection
import psycopg2
from psycopg2.extras import DictCursor

business_lines_router = APIRouter()

# Get all business lines
@business_lines_router.get('/business_lines')
def get_all_business_lines():
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("SELECT strategic_portfolio, product_line FROM pmo.business_lines ORDER BY 1")
        business_lines = cursor.fetchall()

        # Convert rows to a list of dictionaries
        business_lines = [dict(line) for line in business_lines]

        cursor.close()
        return JSONResponse(content=business_lines)  # Return as JSON
    except psycopg2.Error as e:
        print(f"Error during retrieval of business lines: {e}")
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)

# Get all strategic portfolios
@business_lines_router.get('/strategic_portfolios')
def get_all_strategic_portfolios():
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("SELECT DISTINCT strategic_portfolio FROM pmo.business_lines")
        strategic_portfolios = cursor.fetchall()

        # Convert rows to a list of dictionaries
        strategic_portfolios = [dict(portfolio) for portfolio in strategic_portfolios]

        cursor.close()
        return JSONResponse(content=strategic_portfolios)  # Return as JSON
    except psycopg2.Error as e:
        print(f"Error during retrieval of strategic portfolios: {e}")
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)

# Get business lines by strategic portfolio
@business_lines_router.get('/product_lines/{strategic_portfolio}')
def get_product_lines_by_portfolio(strategic_portfolio: str):
    conn = get_pg_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("SELECT strategic_portfolio, product_line FROM pmo.business_lines WHERE strategic_portfolio = %s", (strategic_portfolio,))
        product_lines = cursor.fetchall()

        # Convert rows to a list of dictionaries
        product_lines = [dict(line) for line in product_lines]

        cursor.close()
        return JSONResponse(content=product_lines)  # Return as JSON
    except psycopg2.Error as e:
        print(f"Error during retrieval of product lines: {e}")
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)