import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from io import BytesIO
from db_utils_pg import get_pg_connection, release_pg_connection
import psycopg2
import json
import os

excel_to_db_router = APIRouter()

# Load the configuration file
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "excel_to_db.conf")
try:
    with open(CONFIG_PATH, "r") as config_file:
        CONFIG = json.load(config_file)
except Exception as e:
    raise RuntimeError(f"Failed to load configuration file: {CONFIG_PATH}. Error: {str(e)}")

@excel_to_db_router.post('/excel_to_db')
async def upload_excel_and_upsert(
    table_name: str = Form(...),  # Accept `table_name` as a form field
    file: UploadFile = File(...)  # Accept `file` as a file upload
):
    """
    Reads an uploaded Excel file and inserts/updates data into the specified database table.

    Args:
        table_name (str): Name of the database table to insert/update data.
        file (UploadFile): The uploaded Excel file.

    Returns:
        dict: Summary of the operation (e.g., rows inserted/updated).
    """
    try:
        # Validate table_name
        if table_name not in CONFIG:
            raise HTTPException(status_code=400, detail=f"Unsupported table name: {table_name}")
        print(f"Table name: {table_name}")
        
        # Read the uploaded file content
        contents = await file.read()
        print(f"File name: {file.filename}")
        print(f"File content type: {file.content_type}")

        # Wrap the content in a BytesIO stream for pandas
        excel_stream = BytesIO(contents)

        # Load into pandas DataFrame
        df = pd.read_excel(excel_stream)

        # Debugging: Print the DataFrame and its columns
        print("Loaded DataFrame columns:", df.columns.tolist())
        print("First few rows of the DataFrame:")
        print(df.head())

        # Replace NaN, NaT, inf, and -inf values with None
        df = df.replace([float('inf'), float('-inf')], None).where(pd.notnull(df), None)

        # Convert date fields to DATE(YYYY-MM-DD) format
        date_columns = [col for col in df.columns if "date" in col.lower()]
        for col in date_columns:
            df[col] = df[col].apply(lambda x: x.strftime('%Y-%m-%d') if pd.notnull(x) else None)

        # Debugging: Check for invalid values
        print("Checking for invalid values in the DataFrame...")
        invalid_values = df.isin([None]).sum()
        print("Invalid values per column:")
        print(invalid_values)

        # Ensure all columns are JSON-compliant and replace NaN with None
        for col in df.columns:
            df[col] = df[col].apply(lambda x: None if pd.isna(x) else x)

        # Debugging: Print the cleaned DataFrame
        print("Cleaned DataFrame columns:", df.columns.tolist())
        print("First few rows of the cleaned DataFrame:")
        print(df.head())

        # Convert the DataFrame to a JSON-compliant dictionary
        #json_compliant_data = df.to_dict(orient="records")
        result = process_excel_data(df, table_name)

        # Return the JSON response
        #return JSONResponse(content=json_compliant_data, status_code=200)
        return JSONResponse(content=result, status_code=200)

    except Exception as e:
        print(f"Error in upload_excel_and_upsert: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing Excel file: {str(e)}")


def process_excel_data(df: pd.DataFrame, table_name: str):
    """
    Processes the DataFrame and upserts data into the specified database table.

    Args:
        df (pd.DataFrame): The DataFrame containing the Excel data.
        table_name (str): The name of the database table.

    Returns:
        dict: A dictionary containing the status of the operation.
    """
    conn = None
    try:
        # Get table configuration
        table_config = CONFIG[table_name]
        excel_columns = table_config["excel_columns"]
        db_columns = table_config["db_columns"]
        conflict_columns = table_config["conflict_columns"]
        print("Table configuration:", table_config)

        # Validate column mappings
        if len(excel_columns) != len(db_columns):
            raise HTTPException(status_code=500, detail="Mismatch between Excel columns and database columns in configuration")

        # Map Excel columns to database columns
        column_mapping = dict(zip(excel_columns, db_columns))

        # Filter the DataFrame to include only columns defined in the configuration
        filtered_df = df[excel_columns].rename(columns=column_mapping)

        # Debugging: Print the filtered DataFrame
        print("Filtered DataFrame columns:", filtered_df.columns.tolist())
        print("Filtered DataFrame preview:")
        print(filtered_df.head())

        # Replace NaN and NaT values with None
        filtered_df = filtered_df.where(pd.notnull(filtered_df), None)

        # Establish a database connection
        conn = get_pg_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()

        # Generate the SQL query for upsert
        columns = ", ".join(db_columns)
        placeholders = ", ".join(["%s"] * len(db_columns))
        update_clause = ", ".join([f"{col} = EXCLUDED.{col}" for col in db_columns])
        conflict_clause = ", ".join(conflict_columns)
        query = f"""
            INSERT INTO pmo.{table_name} ({columns})
            VALUES ({placeholders})
            ON CONFLICT ({conflict_clause}) DO UPDATE SET
            {update_clause}
        """

        # Debugging: Print the SQL query
        print("Generated SQL query:")
        print(query)

        # Upsert data into the database table
        for _, row in filtered_df.iterrows():
            # Convert row values to a tuple to avoid 'numpy.ndarray' issues
            row_values = tuple(row.values)
            cursor.execute(query, row_values)

        # Commit the transaction
        conn.commit()
        cursor.close()
        return {"message": f"Data imported successfully into {table_name}"}

    except psycopg2.Error as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        print(f"Unexpected error in process_excel_data: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if conn:
            release_pg_connection(conn)
