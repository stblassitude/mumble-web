import 'stream-browserify' // see https://github.com/ericgundrum/pouch-websocket-sync-example/commit/2a4437b013092cc7b2cd84cf1499172c84a963a3
import 'subworkers' // polyfill for https://bugs.chromium.org/p/chromium/issues/detail?id=31666
import url from 'url'
import ByteBuffer from 'bytebuffer'
import MumbleClient from 'mumble-client'
import WorkerBasedMumbleConnector from './worker-client'
import BufferQueueNode from 'web-audio-buffer-queue'
import audioContext from 'audio-context'
import ko from 'knockout'
import _dompurify from 'dompurify'
import keyboardjs from 'keyboardjs'

const dompurify = _dompurify(window)

function sanitize (html) {
  return dompurify.sanitize(html, {
    ALLOWED_TAGS: ['br', 'b', 'i', 'u', 'a', 'span', 'p']
  })
}

// GUI

class ConnectionInfo {
  constructor (ui) {
    this._ui = ui
    this.visible = ko.observable(false)
    this.serverVersion = ko.observable()
    this.latencyMs = ko.observable(NaN)
    this.latencyDeviation = ko.observable(NaN)
    this.remoteHost = ko.observable()
    this.remotePort = ko.observable()
    this.maxBitrate = ko.observable(NaN)
    this.currentBitrate = ko.observable(NaN)
    this.maxBandwidth = ko.observable(NaN)
    this.currentBandwidth = ko.observable(NaN)
    this.codec = ko.observable()

    this.show = () => {
      if (!ui.thisUser()) return
      this.update()
      this.visible(true)
    }
    this.hide = () => this.visible(false)
  }

  update () {
    let client = this._ui.client

    this.serverVersion(client.serverVersion)

    let dataStats = client.dataStats
    if (dataStats) {
      this.latencyMs(dataStats.mean)
      this.latencyDeviation(Math.sqrt(dataStats.variance))
    }
    this.remoteHost(this._ui.remoteHost())
    this.remotePort(this._ui.remotePort())

    let spp = this._ui.settings.samplesPerPacket
    let maxBitrate = client.getMaxBitrate(spp, false)
    let maxBandwidth = client.maxBandwidth
    let actualBitrate = client.getActualBitrate(spp, false)
    let actualBandwidth = MumbleClient.calcEnforcableBandwidth(actualBitrate, spp, false)
    this.maxBitrate(maxBitrate)
    this.currentBitrate(actualBitrate)
    this.maxBandwidth(maxBandwidth)
    this.currentBandwidth(actualBandwidth)
    this.codec('Opus') // only one supported for sending
  }
}

class GlobalBindings {
  constructor (config) {
    this.config = config
    this.connector = new WorkerBasedMumbleConnector()
    this.connectionInfo = new ConnectionInfo(this)
    this.client = null

    this.connect = (username, host, port, token, password, initialChannelName) => {
      this.resetClient()

      console.log('Connecting to server ' + host)

      // Note: This call needs to be delayed until the user has interacted with
      // the page in some way (which at this point they have), see: https://goo.gl/7K7WLu
      this.connector.setSampleRate(audioContext().sampleRate)

      // TODO: token
      this.connector.connect(`wss://${host}:${port}`, {
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
  console.log("Connecting...");
  ui.connect(
    'web-' + Math.random().toString(36).substring(6),
    queryParams.address,
    queryParams.port,
    queryParams.token,
    queryParams.password,
    queryParams.channel
  );
}

function pauseStream () {
  console.log("Disconnecting.");
  ui.resetClient();
}

window.onload = function () {

  queryParams = url.parse(document.location.href, true).query

  queryParams = Object.assign({}, window.mumbleWebConfig.defaults, queryParams)

  console.log(queryParams)

  document.getElementById('resumeStreamButton').addEventListener('click', resumeStream, false)
  document.getElementById('pauseStreamButton').addEventListener('click', pauseStream, false)

  ko.applyBindings(ui)

}
