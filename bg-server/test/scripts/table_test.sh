echo "Creating table"
curl http://localhost:8080/table/createTable \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{ "table_id": "test6", "player_ids": ["andrew", "annie"], "game_state_id": "catan" }'

echo ''

echo "Adding player Harold"
curl http://localhost:8080/table/test6/addPlayers?player_ids=annie,harold \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{ "player_ids": ["harold", "annie"] }'

echo ''

echo "Retrieving table"
curl http://localhost:8080/table/test6
