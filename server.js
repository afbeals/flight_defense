var express = require('express');
var app = express();
var path = require('path');
app.use(express.static(path.join(__dirname,"./static")));
app.set('views',path.join(__dirname,"./views"));
app.set("view engine","ejs");
app.get('/',function(req,res){
	res.render('index');
});
var server = app.listen(8000,function(){
	console.log("listening on port 8000");
	
});
var io = require('socket.io').listen(server);

//servers player object
var players = {
				player1 : "",
				player2 : "",
				player3 : "",
				player4 : ""
			}

//servers enemy object
var enemies = [
				{bottom: 550, left: 300, speed: 10},
				{bottom: 550, left: 600, speed: 10},	
				{bottom: 550, left: 900, speed: 10}
			]

//count to know when players are ready (4 player game currently)
var playersReady = 0;		

//object / methods to update enemy position
enemyObject = {
			//function to move enemies down game world;
			moveEnemies: function(){
				for(var x in enemies){
					if(enemies[x].bottom > -85){
						enemies[x].bottom -= enemies[x].speed;
					} else{
						enemies[x].left = Math.floor((Math.random() * 1170) + 1);
						enemies[x].bottom = 710;
					}
					//loadEnemies();
				}
			},


			//increase enemy count after interval
			addEnemies: function(){
				setInterval(function(){
					var enemyBottom = 710;
					var enemyleft = Math.floor((Math.random() * 1170) + 1);
					var enemyspeed = Math.floor((Math.random() * 25) + 10);
					if(enemies.length < 10){
						enemies.push({bottom: enemyBottom, left: enemyleft, speed: enemyspeed})
					}
					
				}, 7000)
			}
};

//update enemy information and pass to server.
serverLoop = function(func1,func2,func3){
				setInterval(function(){
					func1();
					//func2();
					//func3();
					io.emit('enemy_update', {enemies: enemies});
				}, 100);
			}



io.sockets.on('connection',function(socket){
	// assign players to their position
	var currentPlayer = "";
	for(var key in players){
		if(!players[key]){
			players[key] = socket.id;
			currentPlayer = key;
			break;
		}
	}

	//start game once all players press spacebar
	socket.on('start_game', function(data){
		playersReady += 1;
		if(playersReady < 2){
			console.log("waiting on more players")
		} else if(playersReady == 2){
			console.log("enough players, started game");
			io.emit('get_ready_to_play');
			setTimeout(function(){
				io.emit("start_for_all");
			serverLoop(enemyObject.moveEnemies);
			enemyObject.addEnemies();
			}, 5000);
		}
	});

	//report player's number back to them after connection, load same enemy information for all browsers
	socket.emit("player_id", {currentPlayerId: socket.id,currentPlayer : currentPlayer, enemyObject: enemyObject })

	//report player connected to everyone else
	socket.broadcast.emit("someone_connected", {player: players});

	//report players movement to other players
	socket.on('player_moved', function(data){
		socket.broadcast.emit("other_players_moved",{player: data.player, movement: data.direction});
		
	});

	//determine which enemy to reset on client collision detection:
	socket.on('reset_enemy',function(data){
		enemies[data.enemyNumber].left = Math.floor((Math.random() * 1170) + 1);
		enemies[data.enemyNumber].bottom = 710;
	});

	//determine winner after game timer runs out
	var winner = "";
	var highScore = 0;
	socket.on('report_local_winner',function(data){
		if(data.highScore > highScore){
			highScore = data.highScore;
			winner = data.winner;
		};
		setTimeout(function(){
			io.emit("final_winner",{winner: winner,highScore:highScore })
		}, 3000);
	});

	//remove player from session
	socket.on('disconnect',function(data){
		for(var key in players){
			(players[key] == socket.id) ? players[key] = "" : console.log("not found")
		}
		if(playersReady > 0){
			playersReady -= 1;
		} else if(playersReady == 0){
			console.log("waiting on more players");
		}
	})
});