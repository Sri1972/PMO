#!/usr/bin/env python3

import sys
sys.path.append('.')

from resources import get_resources
import json

def main():
    print("Testing get_resources endpoint...")
    
    try:
        result = get_resources()
        print(f"Result type: {type(result)}")
        
        if hasattr(result, 'body'):
            # JSONResponse object
            resources_data = json.loads(result.body.decode('utf-8'))
        else:
            # Direct data
            resources_data = result
            
        print(f"Number of resources found: {len(resources_data)}")
        
        # Show first few resources with strategic_portfolio info
        for i, resource in enumerate(resources_data[:5]):
            print(f"\nResource {i+1}:")
            print(f"  resource_id: {resource.get('resource_id')}")
            print(f"  resource_name: {resource.get('resource_name')}")
            print(f"  strategic_portfolio: '{resource.get('strategic_portfolio')}'")
            print(f"  product_line: '{resource.get('product_line')}'")
            
        # Find all unique strategic_portfolio values
        portfolios = set()
        for resource in resources_data:
            portfolio = resource.get('strategic_portfolio')
            if portfolio:
                portfolios.add(portfolio)
                
        print(f"\nUnique strategic_portfolio values found:")
        for portfolio in sorted(portfolios):
            print(f"  '{portfolio}'")
            
        # Test filtering for "Market & Sell"
        target_portfolio = "Market & Sell"
        filtered = [r for r in resources_data if r.get("strategic_portfolio") == target_portfolio]
        print(f"\nResources with strategic_portfolio = '{target_portfolio}': {len(filtered)}")
        
        if filtered:
            print("Found resources:")
            for resource in filtered:
                print(f"  {resource.get('resource_id')}: {resource.get('resource_name')}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()