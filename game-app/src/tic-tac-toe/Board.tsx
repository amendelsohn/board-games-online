import React, {useState} from 'react';
import Square from './Square';
import './Board.css';

type Row = string[];

interface BoardProps {
}

const initial_state: Row[] = [['_', '_', '_'], ['_', '_', '_'], ['_', '_', '_']];

const Board: React.FC<BoardProps> = (props: BoardProps) => {
  const [board_state, setBoardState] = useState(initial_state);
  
  function setLetter(x: number, y: number) {
    return (letter: string) => {
      let updated_board = board_state;
      updated_board[x][y] = letter;
      setBoardState([...updated_board]);
    }
  }

  return (
    <div className="board">
        {
          board_state.map((row, x) => {
            return <div className='row' key={`row-${x}`}>
              {row.map((letter, y) => {
                return <Square 
                  letter={letter}
                  setLetter={setLetter(x, y)}
                  key={`col-${x}-${y}`}
                   />;
              })}
            </div>
          })
        }
    </div>
  );
}

export default Board;
