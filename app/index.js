import 'stream-browserify'; // see https://github.com/ericgundrum/pouch-websocket-sync-example/commit/2a4437b013092cc7b2cd84cf1499172c84a963a3
import 'subworkers'; // polyfill for https://bugs.chromium.org/p/chromium/issues/detail?id=31666
import url from 'url';
import ByteBuffer from 'bytebuffer';
import MumbleClient from 'mumble-client';
import WorkerBasedMumbleConnector from './worker-client';
import BufferQueueNode from 'web-audio-buffer-queue';
import audioContext from 'audio-context';

class GlobalBindings {
	constructor () {
		this.connector = new WorkerBasedMumbleConnector();
		this.client = null;
		this.socketURL = 'wss://<unset>';

		this.connect = (username, host, port, initialChannelName) => {
			this.resetClient();

			console.log('Connecting to server ' + host);

			// Note: This call needs to be delayed until the user has interacted with
			// the page in some way (which at this point they have), see: https://goo.gl/7K7WLu
			this.connector.setSampleRate(audioContext().sampleRate);

			this.socketURL = `wss://${host}:${port}`;

			document.querySelector('#loading b').innerHTML = '[(42%): Breaking down language barriers...]';

			// TODO: token
			this.connector.connect(this.socketURL, {
				username: username,
				password: ''
			}).done(client => {

				console.log('Connected!');
				document.querySelector('#loading b').innerHTML = '[(69%): Cracking enigma...]';

				this.client = client;
				// Prepare for connection errors
				client.on('error', (err) => {
					console.log('Connection error: ' + err);
					this.resetClient();
				});

				// Register all channels, recursively
        // Find first channel path that ends with desired channel(s), separated by slash
				var initialChannel = undefined;
				const registerChannel = (channel, path) => {
          path += '/' + channel.name;
          //console.log('TESTING CHANNEL', path);
					if (path.endsWith(initialChannelName)) {
						initialChannel = channel;
						return;
					}
					channel.children.forEach(c => registerChannel(c, path));
				}
				registerChannel(client.root, '');

				// Register all users
				client.users.forEach(user => this._newUser(user));

				// Register future users in case the sender drops out
				client.on('newUser', user => this._newUser(user));

				// move to initial channel
				if (initialChannel) {
					client.self.setChannel(initialChannel);
				}

				// Tell server this device is muted
				this.client.setSelfMute(true);

				document.querySelector('#loading b').innerHTML = '[(92%): Spreading compassion...]';

				document.getElementById('loading').style.display = 'none';
				document.getElementById('pause').style.display = 'block';
				document.getElementById('statsButton').style.display = 'inline-block';

			}, err => {

				var alertText = "Connection error!\n";

				console.log('Connection error: ' + err);

				if (err.$type && err.$type.name === 'Reject') {

					alertText += 'Type' + err.type + ' ';

					switch (type) {
						case 1:
							alertText += '(incompatible version)';
							break;
						case 2:
							alertText += '(username rejected)';
							break;
						case 3:
							break;
						case 4:
							alertText += '(password incorrect)';
							break;
						case 5:
							alertText += '(username in use)';
							break;
						case 6:
							alertText += '(server full)';
							break;
						case 7:
							alertText += '(certificate required)';
							break;
						default:
							alertText += '(connection refused)';
							break;
					}

					alertText += '\n';

					alertText += 'Reason: ' + err.reason + '\n';

				}

				alert(alertText);

			});

		}

		this._newUser = user => {

			user.on('voice', stream => {

				console.log(`User ${user.username} started talking`);

				var userNode = new BufferQueueNode({
					audioContext: audioContext()
				});
				userNode.connect(audioContext().destination);

				stream.on('data', data => {
					userNode.write(data.buffer);
				}).on('end', () => {
					console.log(`User ${user.username} stopped talking`);
					userNode.end();
				});

			});

		}

		this.resetClient = () => {
			if (this.client) {
				this.client.disconnect();
			}
			this.client = null;
		}

		this.connected = () => this.thisUser() != null;

	}
}
var ui = new GlobalBindings();

// Used only for debugging
window.mumbleUi = ui;

var queryParams = null;

function playStream () {

	document.getElementById('play').style.display = 'none';
	document.getElementById('loading').style.display = 'block';

	document.querySelector('#loading b').innerHTML = '[(16%): Translating rosetta stone...]';

	console.log("Connecting...");
	ui.connect(
		queryParams.username,
		queryParams.address,
		queryParams.port,
		queryParams.channel
	);

}

function pauseStream () {

	document.getElementById('pause').style.display = 'none';
	document.getElementById('play').style.display = 'block';
	document.getElementById('statsButton').style.display = 'none';

	if (showStats) {
		toggleStats();
	}

	console.log("Disconnecting.");
	ui.resetClient();

}

var showStats = false;
var statTimer;

function updateStats (statEl) {

	var c = ui.client;
	var sv = c.serverVersion;

	var latency = c.dataStats ? c.dataStats.mean.toFixed(2) : '--';
	var latencyDev = c.dataStats ? Math.sqrt(c.dataStats.variance).toFixed(2) : '--';

	var codec = 'Opus';
	var spp = 960;

	var brm = (c.getMaxBitrate(spp, false)/1000).toFixed(1);
	var bwm = (c.maxBandwidth/1000).toFixed(1);
	var brc = (c.getActualBitrate(spp, false)/1000).toFixed(1);
	var bwc = (MumbleClient.calcEnforcableBandwidth(brc, spp, false)/1000).toFixed(1);

	var text = `
		<h4>Server</h4>
		<p>
			Mumble Version: ${sv.major}.${sv.minor}.${sv.patch} Rev ${sv.release} <br>
			OS: ${sv.os} ${sv.osVersion}
		</p>
		<h4>Control</h4>
		<p>
			Average latency: ${latency} ms <br>
			Latency deviation: ${latencyDev}<br>
			WebSocket URL: ${ui.socketURL}
		</p>
		<h4>Audio</h4>
		<p>
			Codec: ${codec} <br>
			Samples per Packet: ${spp} <br>
			Maximum Bandwidth: ${brm} kbit/s (${bwm} with overhead) <br>
			Current Bandwidth: ${brc} kbit/s (${bwc} with overhead) <br>
		</p>
	`;

	statEl.innerHTML = text;

}

function toggleStats () {

	var statEl = document.getElementById('stats');

	showStats = !showStats;

	if (showStats) {

		statEl.style.display = 'block';
		statTimer = setInterval(updateStats, 1000, statEl);

	} else {

		statEl.style.display = 'none';
		statEl.innerHTML = '';
		clearInterval(statTimer);

	}

}

window.onload = function () {

	queryParams = url.parse(document.location.href, true).query;

	queryParams = Object.assign({}, window.mumbleWebConfig.defaults, queryParams);

	console.log(queryParams);

	document.getElementById('playButton').addEventListener('click', playStream, false);
	document.getElementById('pauseButton').addEventListener('click', pauseStream, false);
	document.getElementById('statsButton').addEventListener('click', toggleStats, false);

}
