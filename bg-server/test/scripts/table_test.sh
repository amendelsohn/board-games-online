echo "Creating catan game"
curl http://localhost:8080/table/createTable \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{ "table_id": "test1", "player_ids": ["andrew", "annie"], "game_state_id": "catan" }'

echo ''

echo "Retrieving catan game"
curl http://localhost:8080/table/test1
