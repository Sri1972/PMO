# db_utils.py
import pymysql
from pymysql import MySQLError

def get_db_connection():
    try:
        print("Attempting to connect to the database...")  # Log message
        conn = pymysql.connect(
            host="127.0.0.1",  # Host (IP address)
            port=3306,  # Port
            user="Sri",  # Username
            password="Sri",  # Password
            database="pmo"  # Database name
        )
        if conn.open:
            print("Successfully connected to the database.")  # Log success
        return conn
    except MySQLError as e:
        print(f"Database connection failed: {e}")  # Log the error
        return None