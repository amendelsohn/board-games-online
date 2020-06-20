import React from 'react';
import './Square.css';

interface SquareProps {
    letter: string;
    setLetter: (arg0: string) => void;
}

const Square: React.FC<SquareProps> = (props: SquareProps) => {
  return (
    <div className="square" onClick={() => props.setLetter(props.letter === 'O' ? 'X' : 'O')}>
        {props.letter}
    </div>
  );
}

export default Square;
