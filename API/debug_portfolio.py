#!/usr/bin/env python3

import sys
sys.path.append('.')

import asyncio
from resources import resource_capacity_allocation_per_portfolio
import json

async def main():
    print("Testing resource_capacity_allocation_per_portfolio endpoint...")
    
    try:
        result = await resource_capacity_allocation_per_portfolio(
            strategic_portfolio="Market & Sell",
            product_line=None,
            start_date="2025-01-01",
            end_date="2025-12-31",
            interval="Weekly"
        )
        
        print(f"Result type: {type(result)}")
        
        if hasattr(result, 'body'):
            # JSONResponse object
            response_data = json.loads(result.body.decode('utf-8'))
        else:
            # Direct data
            response_data = result
            
        print(f"Response data: {json.dumps(response_data, indent=2)}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())