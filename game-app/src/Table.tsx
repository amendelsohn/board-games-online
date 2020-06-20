import React, { useEffect } from 'react';
import Board from './tic-tac-toe/Board'
import './Table.css';

function Table() {
  useEffect(() => {
    // run only on first render
    fetch('http://localhost:8080/table')
      .then(response => response.json())
      .then(data => console.log(data));
  }, [])

  return (
    <div className="Table">
      <Board />
    </div>
  );
}

export default Table;
