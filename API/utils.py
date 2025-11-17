from decimal import Decimal
from datetime import date

def convert_decimal_to_float(data):
    """
    Recursively convert Decimal objects to float and date objects to string in a dictionary or list.
    Also converts None values to 0.
    """
    if isinstance(data, list):
        return [convert_decimal_to_float(item) for item in data]
    elif isinstance(data, dict):
        return {key: convert_decimal_to_float(value) for key, value in data.items()}
    elif isinstance(data, Decimal):
        return float(data)  # Convert Decimal to float
    elif isinstance(data, date):
        return data.strftime('%Y-%m-%d')  # Convert date to string
    elif data is None:
        return None
    else:
        return data
