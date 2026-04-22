echo "Creating player1"
curl http://localhost:8080/player/createPlayer \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{ "player_id": "player1", "name": "andrew" }'

echo ''

echo "Retrieving player1"
curl http://localhost:8080/player/player1
