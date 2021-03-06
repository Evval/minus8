import axios from "axios";

export default _store => {
  let socket = {};
  let store = _store;

  function connectToServer() {
    socket = initWs(socket, store);
    fetchGameData(store.state, store.state.gameId);
  }

  function initWs(socket, store) {
    socket = new WebSocket(API_HOST + "/server");
    socket.sendJSON = data => {
      socket.send(JSON.stringify(data));
    };
    socket.onopen = () => {
      socket.sendJSON({
        event: "game-enter",
        gameId: store.state.gameId,
      });
    };
    socket.onmessage = msg => {
      let data = JSON.parse(msg.data);
      switch (data.event) {
        case "new-turn":
          store.commit("makeTurn", data.cellId);
          break;
        default:
          break;
      }
    };
    return socket;
  }

  function fetchGameData(state, id) {
    axios
      .get(`/server/game/${state.gameId}`)
      .then(res => {
        if (!res.data.error) {
          let game = res.data;
          let cellsById = {};

          game.board.forEach(row => {
            row.forEach(cell => {
              cellsById[cell.id] = cell;
            });
          });

          game.players.x.control =
            game.players.x.playerId === state.playerId ? "user" : "server";
          game.players.y.control =
            game.players.y.playerId === state.playerId ? "user" : "server";

          store.replaceState({
            boardSize: game.boardSize || 8,
            gameId: game.id,
            playerId: state.playerId,
            gameMode: "online",
            gameStarted: true,
            boardMap: game.board,
            cellsById: cellsById,
            turnHistory: game.turnHistory,
            firstCell: cellsById[game.firstCell],
            players: game.players,
            playerSecret: state.playerSecret,
            firstPlayerId: game.firstPlayer,
            playerLeft: game.playerLeft
          });
        }
      })
      .catch(err => {
        console.error(err);
      });
  }

  store.subscribe((mutation, state) => {
    // called after every mutation.
    // The mutation comes in the format of `{ type, payload }`.
    switch (mutation.type) {
      case "setGameMode":
        if (mutation.payload.mode === "online") {
          connectToServer();
        }
        break;
      case "disconnect":
        if (state.gameMode === "online") socket.close();
        break;
      default:
        break;
    }
  });
  store.subscribeAction((action, state) => {
    switch (action.type) {
      case "makeTurn":
        if (state.gameMode === "online") {
          if (!action.payload.fromServer) {
            socket.sendJSON({
              event: "new-turn",
              gameId: state.gameId,
              cellId: action.payload,
              playerSecret: state.playerSecret
            });
          }
        }
        break;
      default:
        break;
    }
  });
};
