#!/usr/bin/env python3

import sys
sys.path.append('.')

import asyncio
from resources import get_resource_capacity_allocation_route
import json

async def main():
    print("Testing get_resource_capacity_allocation_route for resource_id=2...")
    
    try:
        result = await get_resource_capacity_allocation_route(
            resource_id="2",  # Jasveer Singh from Market & Sell
            start_date="2025-01-01",
            end_date="2025-12-31",
            interval="Monthly"
        )
        
        print(f"Result type: {type(result)}")
        
        if hasattr(result, 'body'):
            # JSONResponse object
            response_data = json.loads(result.body.decode('utf-8'))
        else:
            # Direct data
            response_data = result
        
        # Handle new response structure with resource_details and data
        if isinstance(response_data, dict) and "resource_details" in response_data:
            print("Resource Details:")
            print(json.dumps(response_data["resource_details"], indent=2))
            print("\nCapacity Data:")
            print(json.dumps(response_data["data"][:3], indent=2))  # Show first 3 items
            print(f"... and {len(response_data['data']) - 3} more items" if len(response_data['data']) > 3 else "")
        else:
            # Fallback for old response format
            print(f"Response data: {json.dumps(response_data, indent=2)}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())