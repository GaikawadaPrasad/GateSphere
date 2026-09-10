# Owner / Tenant Module 10: Vehicles & Parking

## Purpose
Enables homeowners to register household vehicles, associate Gate FastTags / RFIDs for automatic boom barrier clearance, check assigned parking spots, and review parking violation logs.

## Key Data Fields
- `license_plate`: Vehicle registration number (`CA-992-K`)
- `make_model`: Vehicle details (`Tesla Model 3 - White`)
- `allocated_slot`: Basement/podium parking slot (`Basement 1, Spot #B1-104`)
- `rfid_tag`: RFID credential ID (`TAG-9018-ACTIVE`)
- `violations_count`: Number of recorded parking warnings (0)

## API Endpoints
- `GET /api/v1/vehicles`
- `POST /api/v1/vehicles`
- `GET /api/v1/vehicles/parking-slots`
