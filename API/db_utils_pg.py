import psycopg2
from psycopg2 import OperationalError
from psycopg2.pool import SimpleConnectionPool

# Initialize the connection pool
connection_pool = None
try:
    print("Initializing PostgreSQL connection pool...")  # Log message
    connection_pool = SimpleConnectionPool(
        1,  # Minimum number of connections
        20,  # Maximum number of connections
        host="127.0.0.1",  # Host (IP address)
        port=5432,  # Port
        user="postgres",  # Username
        password="admin123",  # Password
        database="pmodb"  # Database name
    )
    if connection_pool:
        print("PostgreSQL connection pool initialized successfully.")  # Log success
except OperationalError as e:
    print(f"Failed to initialize PostgreSQL connection pool: {e}")  # Log the error

def get_pg_connection():
    try:
        if connection_pool:
            print("Fetching a connection from the pool...")  # Log message
            conn = connection_pool.getconn()
            if conn:
                print("Successfully fetched a connection from the pool.")  # Log success
                return conn
        else:
            print("Connection pool is not initialized.")  # Log error
            return None
    except OperationalError as e:
        print(f"Failed to fetch a connection from the pool: {e}")  # Log the error
        return None

def release_pg_connection(conn):
    try:
        if connection_pool and conn:
            print("Releasing the connection back to the pool...")  # Log message
            connection_pool.putconn(conn)
            print("Connection released successfully.")  # Log success
    except Exception as e:
        print(f"Failed to release the connection: {e}")  # Log the error

def close_connection_pool():
    try:
        if connection_pool:
            print("Closing all connections in the pool...")  # Log message
            connection_pool.closeall()
            print("Connection pool closed successfully.")  # Log success
    except Exception as e:
        print(f"Failed to close the connection pool: {e}")  # Log the error
