
import React, { useState, useEffect, useCallback } from 'react';
import './RotaGame.css';

const RotaGame: React.FC = () => {
    const POSITIONS = 9;
    const PLAYER1 = 1;
    const PLAYER2 = 2;
    const EMPTY = 0;

    const adjacent = {
        0: [1, 2, 3, 4, 5, 6, 7, 8],
        1: [0, 2, 8],
        2: [0, 1, 3],
        3: [0, 2, 4],
        4: [0, 3, 5],
        5: [0, 4, 6],
        6: [0, 5, 7],
        7: [0, 6, 8],
        8: [0, 7, 1]
    };

    const winningLines = [
        [1, 0, 5], [2, 0, 6], [3, 0, 7], [4, 0, 8],
        [1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6],
        [5, 6, 7], [6, 7, 8], [7, 8, 1], [8, 1, 2]
    ];

    const [board, setBoard] = useState(Array(POSITIONS).fill(EMPTY));
    const [currentPlayer, setCurrentPlayer] = useState(PLAYER1);
    const [phase, setPhase] = useState('placement');
    const [piecesPlaced, setPiecesPlaced] = useState(0);
    const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
    const [status, setStatus] = useState('');

    const checkWin = useCallback((player: number, tempBoard = board) => {
        for (let line of winningLines) {
            if (line.every(pos => tempBoard[pos] === player)) {
                return true;
            }
        }
        return false;
    }, [board, winningLines]);

    const updateStatus = useCallback(() => {
        if (checkWin(PLAYER1)) {
            setStatus("You win!");
            return;
        }
        if (checkWin(PLAYER2)) {
            setStatus("AI wins!");
            return;
        }
        let phaseText = phase === 'placement' ? 'Placement Phase: Click an empty spot.' : 'Moving Phase: Click your piece, then an adjacent empty spot.';
        setStatus(`${currentPlayer === PLAYER1 ? "Your turn" : "AI's turn"} - ${phaseText}`);
    }, [checkWin, currentPlayer, phase, PLAYER1, PLAYER2]);


    const resetGame = () => {
        setBoard(Array(POSITIONS).fill(EMPTY));
        setCurrentPlayer(PLAYER1);
        setPhase('placement');
        setPiecesPlaced(0);
        setSelectedPiece(null);
    };

    const handleClick = (pos: number) => {
        if (currentPlayer !== PLAYER1 || checkWin(PLAYER1) || checkWin(PLAYER2)) return;

        if (phase === 'placement') {
            if (board[pos] === EMPTY) {
                const newBoard = [...board];
                newBoard[pos] = PLAYER1;
                setBoard(newBoard);
                const newPiecesPlaced = piecesPlaced + 1;
                setPiecesPlaced(newPiecesPlaced);
                if (newPiecesPlaced === 6) setPhase('moving');
                setCurrentPlayer(PLAYER2);
            }
        } else if (phase === 'moving') {
            if (selectedPiece === null) {
                if (board[pos] === PLAYER1) {
                    setSelectedPiece(pos);
                }
            } else {
                if (pos === selectedPiece) {
                    setSelectedPiece(null);
                } else if (board[pos] === EMPTY && adjacent[selectedPiece as keyof typeof adjacent].includes(pos)) {
                    const newBoard = [...board];
                    newBoard[pos] = PLAYER1;
                    newBoard[selectedPiece] = EMPTY;
                    setBoard(newBoard);
                    setSelectedPiece(null);
                    setCurrentPlayer(PLAYER2);
                }
            }
        }
    };

    const aiMove = useCallback(() => {
        if (checkWin(PLAYER1) || checkWin(PLAYER2)) return;
    
        const evaluate = (tempBoard: number[], tempPhase: string) => {
            if (checkWin(PLAYER2, tempBoard)) return 1000;
            if (checkWin(PLAYER1, tempBoard)) return -1000;
    
            let score = 0;
            for (let line of winningLines) {
                let aiCount = 0, humanCount = 0;
                line.forEach(p => {
                    if (tempBoard[p] === PLAYER2) aiCount++;
                    else if (tempBoard[p] === PLAYER1) humanCount++;
                });
                if (aiCount === 2 && humanCount === 0) score += 10;
                else if (aiCount === 1 && humanCount === 0) score += 1;
                if (humanCount === 2 && aiCount === 0) score -= 10;
                else if (humanCount === 1 && aiCount === 0) score -= 1;
            }
            if (tempBoard[0] === PLAYER2) score += 5;
            else if (tempBoard[0] === PLAYER1) score -= 5;
    
            if (tempPhase === 'moving') {
                let aiMobility = 0, humanMobility = 0;
                for (let i = 0; i < POSITIONS; i++) {
                    if (tempBoard[i] === PLAYER2) aiMobility += adjacent[i as keyof typeof adjacent].filter(p => tempBoard[p] === EMPTY).length;
                    else if (tempBoard[i] === PLAYER1) humanMobility += adjacent[i as keyof typeof adjacent].filter(p => tempBoard[p] === EMPTY).length;
                }
                score += aiMobility - humanMobility;
            }
            return score;
        };
    
        const minimax = (tempBoard: number[], depth: number, alpha: number, beta: number, isMaximizing: boolean, tempPhase: string, tempPiecesPlaced: number): number => {
            if (depth === 0 || checkWin(PLAYER1, tempBoard) || checkWin(PLAYER2, tempBoard)) {
                return evaluate(tempBoard, tempPhase);
            }
    
            const player = isMaximizing ? PLAYER2 : PLAYER1;
            const moves = getPossibleMoves(tempBoard, player, tempPhase);
    
            if (isMaximizing) {
                let maxEval = -Infinity;
                for (let move of moves) {
                    const newBoard = [...tempBoard];
                    let newPieces = tempPiecesPlaced;
                    let newPhase = tempPhase;
                    if (tempPhase === 'placement') {
                        newBoard[move as number] = player;
                        newPieces++;
                        if (newPieces === 6) newPhase = 'moving';
                    } else {
                        const [from, to] = move as [number, number];
                        newBoard[to] = player;
                        newBoard[from] = EMPTY;
                    }
                    const evalScore = minimax(newBoard, depth - 1, alpha, beta, false, newPhase, newPieces);
                    maxEval = Math.max(maxEval, evalScore);
                    alpha = Math.max(alpha, maxEval);
                    if (beta <= alpha) break;
                }
                return maxEval;
            } else {
                let minEval = Infinity;
                for (let move of moves) {
                    const newBoard = [...tempBoard];
                    let newPieces = tempPiecesPlaced;
                    let newPhase = tempPhase;
                    if (tempPhase === 'placement') {
                        newBoard[move as number] = player;
                        newPieces++;
                        if (newPieces === 6) newPhase = 'moving';
                    } else {
                        const [from, to] = move as [number, number];
                        newBoard[to] = player;
                        newBoard[from] = EMPTY;
                    }
                    const evalScore = minimax(newBoard, depth - 1, alpha, beta, true, newPhase, newPieces);
                    minEval = Math.min(minEval, evalScore);
                    beta = Math.min(beta, minEval);
                    if (beta <= alpha) break;
                }
                return minEval;
            }
        };
    
        const getPossibleMoves = (tempBoard: number[], player: number, tempPhase: string) => {
            const moves: (number | [number, number])[] = [];
            if (tempPhase === 'placement') {
                for (let i = 0; i < POSITIONS; i++) {
                    if (tempBoard[i] === EMPTY) moves.push(i);
                }
            } else {
                for (let i = 0; i < POSITIONS; i++) {
                    if (tempBoard[i] === player) {
                        adjacent[i as keyof typeof adjacent].filter(p => tempBoard[p] === EMPTY).forEach(t => moves.push([i, t]));
                    }
                }
            }
            return moves;
        };
    
        const MAX_DEPTH = 6;
        let bestScore = -Infinity;
        let bestMove: number | [number, number] | null = null;
        const moves = getPossibleMoves(board, PLAYER2, phase);
    
        if (moves.length === 0) {
            setCurrentPlayer(PLAYER1);
            return;
        }
    
        for (let move of moves) {
            const newBoard = [...board];
            let newPhase = phase;
            let newPieces = piecesPlaced;
            if (phase === 'placement') {
                newBoard[move as number] = PLAYER2;
                newPieces++;
                if (newPieces === 6) newPhase = 'moving';
            } else {
                const [from, to] = move as [number, number];
                newBoard[to] = PLAYER2;
                newBoard[from] = EMPTY;
            }
            const score = minimax(newBoard, MAX_DEPTH - 1, -Infinity, Infinity, false, newPhase, newPieces);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
    
        if (bestMove !== null) {
            const newBoard = [...board];
            if (phase === 'placement') {
                newBoard[bestMove as number] = PLAYER2;
                const newPiecesPlaced = piecesPlaced + 1;
                setPiecesPlaced(newPiecesPlaced);
                if (newPiecesPlaced === 6) setPhase('moving');
            } else {
                const [from, to] = bestMove as [number, number];
                newBoard[to] = PLAYER2;
                newBoard[from] = EMPTY;
            }
            setBoard(newBoard);
        }
        setCurrentPlayer(PLAYER1);
    }, [board, checkWin, phase, piecesPlaced, PLAYER1, PLAYER2, winningLines, adjacent]);

    useEffect(() => {
        updateStatus();
        if (currentPlayer === PLAYER2) {
            const timer = setTimeout(aiMove, 500);
            return () => clearTimeout(timer);
        }
    }, [currentPlayer, board, aiMove, updateStatus]);

    return (
        <div className="text-center p-4 border rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold mb-2">Bored? Play a quick game of Rota (Roman tic-tac-toe).</h3>
            <div id="game-container">
                <svg id="svg-board" viewBox="-100 -100 200 200">
                    <circle cx="0" cy="0" r="90" fill="none" stroke="black" strokeWidth="2" />
                    <line x1="0" y1="0" x2="90" y2="0" stroke="black" strokeWidth="2" />
                    <line x1="0" y1="0" x2="63.64" y2="63.64" stroke="black" strokeWidth="2" />
                    <line x1="0" y1="0" x2="0" y2="90" stroke="black" strokeWidth="2" />
                    <line x1="0" y1="0" x2="-63.64" y2="63.64" stroke="black" strokeWidth="2" />
                    <line x1="0" y1="0" x2="-90" y2="0" stroke="black" strokeWidth="2" />
                    <line x1="0" y1="0" x2="-63.64" y2="-63.64" stroke="black" strokeWidth="2" />
                    <line x1="0" y1="0" x2="0" y2="-90" stroke="black" strokeWidth="2" />
                    <line x1="0" y1="0" x2="63.64" y2="-63.64" stroke="black" strokeWidth="2" />
                    {Array.from({ length: POSITIONS }).map((_, i) => {
                        const cx = i === 0 ? 0 : 90 * Math.cos((i - 1) * Math.PI / 4);
                        const cy = i === 0 ? 0 : 90 * Math.sin((i - 1) * Math.PI / 4);
                        if (i > 0) { // Adjusting for my coordinate system
                            const temp = cx;
                            // Standard SVG is x right, y down. My logic was x right, y up.
                            // Let's use a simpler mapping based on the original HTML
                        }
                        const positions = [
                            {cx: 0, cy: 0}, {cx: 90, cy: 0}, {cx: 63.64, cy: 63.64},
                            {cx: 0, cy: 90}, {cx: -63.64, cy: 63.64}, {cx: -90, cy: 0},
                            {cx: -63.64, cy: -63.64}, {cx: 0, cy: -90}, {cx: 63.64, cy: -63.64}
                        ];
                        const p = positions[i];

                        return (
                            <circle
                                key={i}
                                id={`pos${i}`}
                                cx={p.cx}
                                cy={p.cy}
                                r="10"
                                fill={
                                    board[i] === PLAYER1 ? (selectedPiece === i ? 'lightblue' : 'blue') :
                                    board[i] === PLAYER2 ? 'red' : 'white'
                                }
                                stroke="black"
                                onClick={() => handleClick(i)}
                                style={{ cursor: 'pointer' }}
                            />
                        );
                    })}
                </svg>
            </div>
            <div id="status" className="mt-4 font-medium">{status}</div>
            <button onClick={resetGame} className="mt-2 px-4 py-2 bg-orange text-white rounded hover:bg-opacity-80">
                Restart Game
            </button>
        </div>
    );
};

export default RotaGame;
