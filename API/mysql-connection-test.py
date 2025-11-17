import pymysql

print("Starting the connection process...")

try:
    print("Connecting....")  # This will help us confirm the script is getting here
    conn = pymysql.connect(
        host="127.0.0.1",
        port=3306,
        user="Sri",
        password="ManSid!972",
        database="pmo"
    )
    print("Connection successful!")
except pymysql.MySQLError as err:
    print("Connection failed!")
    print(f"Error: {err}")
else:
    print("Connection is open.")
    conn.close()
    print("Connection closed.")