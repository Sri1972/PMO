#!/usr/bin/env python3

import sys
sys.path.append('.')

import asyncio
from resources import get_resource_capacity_allocation_route
import json

async def main():
    print("Testing corrected block aggregation for resource_id=2...")
    
    try:
        result = await get_resource_capacity_allocation_route(
            resource_id="2",
            start_date="2025-01-02",
            end_date="2025-12-22",
            interval="Monthly"  # Use Monthly as default to test the new logic
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
            print(f"  Resource: {response_data['resource_details']['resource_name']} (ID: {response_data['resource_details']['resource_id']})")
            print(f"  Role: {response_data['resource_details']['resource_role']}")
            print(f"  Yearly Capacity: {response_data['resource_details']['yearly_capacity']}")
            
            blocks_data = response_data["data"]
        else:
            # Fallback for old response format
            blocks_data = response_data if isinstance(response_data, list) else []
            
        print(f"Number of blocks: {len(blocks_data)}")
        
        # Show detailed information for each block
        total_capacity_check = 0
        for i, block in enumerate(blocks_data):
            print(f"\nBlock {i+1}:")
            print(f"  Period: {block.get('start_date')} to {block.get('end_date')}")
            print(f"  Total Capacity: {block.get('total_capacity')}")
            print(f"  Planned Hours: {block.get('allocation_hours_planned')}")
            print(f"  Actual Hours: {block.get('allocation_hours_actual')}")
            print(f"  Available Capacity: {block.get('available_capacity')}")
            print(f"  Project Details:")
            
            for project in block.get('project_allocation_details', []):
                print(f"    - {project.get('project_name')}: {project.get('planned_hours')} hrs planned ({project.get('planned_percentage')}%)")
            
            total_capacity_check += block.get('total_capacity', 0)
        
        print(f"\nTotal capacity across all blocks: {total_capacity_check}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())