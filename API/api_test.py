import pytest
import json
from projects_resources import app  # Import the Flask app

@pytest.fixture
def client():
    with app.test_client() as client:
        yield client

def load_json(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

def test_add_project(client):
    project_data = load_json('test_data/project.json')
    response = client.post('/projects', json=project_data)
    assert response.status_code == 201
    assert response.json['message'] == 'Project added successfully'

def test_add_resource(client):
    resource_data = load_json('test_data/resource.json')
    response = client.post('/resources', json=resource_data)
    assert response.status_code == 201
    assert response.json['message'] == 'Resource added successfully'

def test_allocate_resource(client):
    allocation_data = load_json('test_data/project_allocation.json')
    response = client.post('/allocate', json=allocation_data)
    assert response.status_code == 201
    assert response.json['message'] == 'Resource allocated to project successfully'

def test_get_projects(client):
    response = client.get('/projects')
    assert response.status_code == 200
    assert isinstance(response.json, list)

def test_get_resources(client):
    response = client.get('/resources')
    assert response.status_code == 200
    assert isinstance(response.json, list)

def test_get_project_by_id(client):
    project_id = 1  # Example project ID
    response = client.get(f'/projects/{project_id}')
    assert response.status_code == 200
    assert isinstance(response.json, dict)

def test_get_resource_by_id(client):
    resource_id = 1  # Example resource ID
    response = client.get(f'/resources/{resource_id}')
    assert response.status_code == 200
    assert isinstance(response.json, dict)

def test_get_allocations_by_project(client):
    project_id = 1  # Example project ID
    response = client.get(f'/allocations/project/{project_id}')
    assert response.status_code == 200
    assert isinstance(response.json, list)

def test_get_allocations_by_resource(client):
    resource_id = 1  # Example resource ID
    response = client.get(f'/allocations/resource/{resource_id}')
    assert response.status_code == 200
    assert isinstance(response.json, list)