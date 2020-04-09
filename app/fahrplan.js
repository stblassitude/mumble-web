function updateUI(room, day, cday, time, title, started) {

  const el = document.querySelector('#' + room.toLowerCase() + ' .talkinfo')

  const status = started ? 'Since ' : 'Starts '

  const dayInfo = (day != cday) ? `Day ${cday+1}, ` : ''

  el.innerHTML = `
    <span>${status}${dayInfo}${time}</span>
    <h4>${title}</h4>
  `

}

function findCurrentTalks(xml) {

  const now = new Date()

  // switch day over at 4:00 AM
  var dayDate = new Date(now.getTime())
  dayDate.setHours(now.getHours() - 4)

  // 1st day is 11th
  const day = dayDate.getDate() - 11
  const cday = (day >= 0) ? day : 0

  const rooms = xml.getElementsByTagName("day")[cday]
                   .getElementsByTagName("room")

  for (const room of rooms) {

    const talks = room.getElementsByTagName("event")
    for (const talk of talks) {

      const date = new Date(talk.getElementsByTagName("date")[0].childNodes[0].nodeValue)
      const dur = talk.getElementsByTagName("duration")[0].childNodes[0].nodeValue.split(':')
      const durMins = (dur[0] * 60) + (dur[1] * 1)
      const end = new Date(date.getTime() + durMins * 60 * 1000)

      const started = ((date - now) < 0)
      const over = ((end - now) < 0)
      if (over)
        continue // check if next talk is relevant

      updateUI( room.attributes.name.value,
                day,
                cday,
                talk.getElementsByTagName("start")[0].childNodes[0].nodeValue,
                talk.getElementsByTagName("title")[0].childNodes[0].nodeValue,
                started)

      break

    }

  }

}

function updateFromFahrplan() {

  const pMain = (fetch('/fahrplan.xml')
    .then(response => response.text()))

  pMain.then(function(text) {

    const xml = (new window.DOMParser()).parseFromString(text, "text/xml")

    console.log(xml)

    findCurrentTalks(xml.getElementsByTagName("schedule")[0])

  })

}

window.onload = function() {

  updateFromFahrplan()

}
