import 'stream-browserify' // see https://github.com/ericgundrum/pouch-websocket-sync-example/commit/2a4437b013092cc7b2cd84cf1499172c84a963a3
import 'subworkers' // polyfill for https://bugs.chromium.org/p/chromium/issues/detail?id=31666
import url from 'url'
import ByteBuffer from 'bytebuffer'
import MumbleClient from 'mumble-client'
import WorkerBasedMumbleConnector from './worker-client'
import BufferQueueNode from 'web-audio-buffer-queue'
import audioContext from 'audio-context'

class GlobalBindings {
  constructor (config) {
    this.config = config
    this.connector = new WorkerBasedMumbleConnector()
    this.client = null
    this.socketURL = 'wss://<unset>'

    this.connect = (username, host, port, token, password, initialChannelName) => {
      this.resetClient()

      console.log('Connecting to server ' + host)

      // Note: This call needs to be delayed until the user has interacted with
      // the page in some way (which at this point they have), see: https://goo.gl/7K7WLu
      this.connector.setSampleRate(audioContext().sampleRate)

      this.socketURL = `wss://${host}:${port}`

      // TODO: token
      this.connector.connect(this.socketURL, {
        username: username,
        password: password
      }).done(client => {

        console.log('Connected!')

        this.client = client
        // Prepare for connection errors
        client.on('error', (err) => {
          console.log('Connection error: ' + err)
          this.resetClient()
        })

        // Register all channels, recursively
        var initialChannel = undefined
        const registerChannel = channel => {
          if (channel.name == initialChannelName) {
            initialChannel = channel
            return
          }
          channel.children.forEach(registerChannel)
        }
        registerChannel(client.root)

        // Register all users
        client.users.forEach(user => this._newUser(user))

        // move to initial channel
        if (initialChannel) {
          client.self.setChannel(initialChannel)
        }

        // Tell server this device is muted
        this.client.setSelfMute(true)

      }, err => {

        var alertText = "Connection error!\n"

        console.log('Connection error: ' + err)

        if (err.$type && err.$type.name === 'Reject') {

          alertText += 'Type' + err.type + ' '

          switch (type) {
            case 1:
              alertText += '(incompatible version)'
            case 2:
              alertText += '(username rejected)'
            case 3:
            case 4:
              alertText += '(password incorrect)'
            case 5:
              alertText += '(username in use)'
            case 6:
              alertText += '(server full)'
            case 7:
              alertText += '(certificate required)'
            default:
              alertText += '(connection refused)'
          }

          alertText += '\n'

          alertText += 'Reason: ' + err.reason + '\n'

        }

        alert(alertText)

      })

    }

    this._newUser = user => {

      user.on('voice', stream => {

        console.log(`User ${user.username} started talking`)

        var userNode = new BufferQueueNode({
          audioContext: audioContext()
        })
        userNode.connect(audioContext().destination)

        stream.on('data', data => {
          userNode.write(data.buffer)
        }).on('end', () => {
          console.log(`User ${user.username} stopped talking`)
          userNode.end()
        })

      })

    }

    this.resetClient = () => {
      if (this.client) {
        this.client.disconnect()
      }
      this.client = null
    }

    this.connected = () => this.thisUser() != null

  }
}
var ui = new GlobalBindings(window.mumbleWebConfig)

// Used only for debugging
window.mumbleUi = ui

var queryParams = null

function resumeStream () {

  console.log("Connecting...")
  ui.connect(
    'web-' + Math.random().toString(36).substring(6),
    queryParams.address,
    queryParams.port,
    queryParams.token,
    queryParams.password,
    queryParams.channel
  )

}

function pauseStream () {

  console.log("Disconnecting.")
  ui.resetClient()

}

var showStats = false
var statTimer

function updateStats (statEl) {

  var c = ui.client,
      sv = c.serverVersion

  var latency = c.dataStats ? c.dataStats.mean.toFixed(2) : '--',
      latencyDev = c.dataStats ? Math.sqrt(c.dataStats.variance.toFixed(2)) : '--'

  var codec = 'Opus',
      spp = window.mumbleWebConfig.settings.samplesPerPacket

  var brm = (c.getMaxBitrate(spp, false)/1000).toFixed(1),
      bwm = (c.maxBandwidth/1000).toFixed(1),
      brc = (c.getActualBitrate(spp, false)/1000).toFixed(1),
      bwc = (MumbleClient.calcEnforcableBandwidth(brc, spp, false)/1000).toFixed(1)

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
  `

  statEl.innerHTML = text

}

function toggleStats () {

  var statEl = document.getElementById('stats')

  showStats = !showStats

  if (showStats) {

    statTimer = setInterval(updateStats, 1000, statEl)

  } else {

    clearInterval(statTimer)
    statEl.innerHTML = ''

  }

}

window.onload = function () {

  queryParams = url.parse(document.location.href, true).query

  queryParams = Object.assign({}, window.mumbleWebConfig.defaults, queryParams)

  console.log(queryParams)

  document.getElementById('resumeStreamButton').addEventListener('click', resumeStream, false)
  document.getElementById('pauseStreamButton').addEventListener('click', pauseStream, false)
  document.getElementById('statsButton').addEventListener('click', toggleStats, false)

}
