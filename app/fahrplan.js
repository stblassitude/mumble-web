var C3T_ROOM_MAP = {
  'Piscopia': document.querySelector('#piscopia .talkinfo'),
}

function updateUI(room, day, cday, time, title, started) {

  const el = C3T_ROOM_MAP[room]

  const status = started ? 'since ' : 'starts '

  const dayInfo = (day != cday) ? `Day ${cday+1}, ` : ''

  el.innerHTML = `
    <span>${status}${dayInfo}${time}</span>
    <h4>${title}</h4>
  `

}

function daysBetween(date1, date2) {

    // The number of milliseconds in one day
    const ONE_DAY = 1000 * 60 * 60 * 24;

    // Calculate the difference in milliseconds
    const differenceMs = date1 - date2;

    // Convert back to days and return
    return Math.floor(differenceMs / ONE_DAY);

}

function findCurrentTalksJSON(json) {

  const now = new Date()
  const startDate = new Date(json.start)

  // switch day over at 4:00 AM
  var dayDate = new Date(now.getTime())
  dayDate.setHours(now.getHours() - 4)

  const day = daysBetween(dayDate, startDate)
  const cday = (day >= 0) ? day : 0

  const rooms = json.days[cday].rooms
  for (const room in rooms) {

    // Skip all rooms we don't support
    if (C3T_ROOM_MAP.hasOwnProperty(room) == false)
      continue

    const talks = rooms[room]
    for (const talk of talks) {

      const date = new Date(talk.date)
      const dur = talk.duration.split(':')
      const durMins = (dur[0] * 60) + (dur[1] * 1)
      const end = new Date(date.getTime() + durMins * 60 * 1000)

      const started = ((date - now) < 0)
      const over = ((end - now) < 0)
      if (over)
        continue // check if next talk is relevant

      updateUI(room, day, cday, talk.start, talk.title, started)

      break

    }

  }

}

function findCurrentTalksXML(xml) {

  const now = new Date()

  const conf = xml.getElementsByTagName("conference")[0]
  const startDateUTC = conf.getElementsByTagName("start")[0].childNodes[0].nodeValue
  const startDate = new Date(startDateUTC)

  // switch day over at 4:00 AM
  var dayDate = new Date(now.getTime())
  dayDate.setHours(now.getHours() - 4)

  const day = daysBetween(dayDate, startDate)
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

function updateFromFahrplan(url) {

  const pMain = fetch(url)
    .then(response => response.json())
    .catch(error => {
      console.log("Could not retrieve schedule info.")
      return null;
    })

  // Add multiple fahrplans in this list
  Promise.all([pMain])
    .then(function(jsons) {

      if (jsons[0] == null)
        return;

      var json = jsons[0].schedule.conference

      // XML
      //const xml = (new window.DOMParser()).parseFromString(text, "text/xml")
      //console.log(xml)
      //findCurrentTalksXML(xml.getElementsByTagName("schedule")[0])

      // Old multi-fahrplan stuff, should be redone.
      //const jsonWikipaka = jsons[1].schedule.conference

      //for (var i = 0; i < json.days.length; i++) {
      //
      //  const wikipakaRoom = jsonWikipaka.days[i].rooms['WikiPaka WG: Esszimmer']
      //  json.days[i].rooms['WikiPaka'] = wikipakaRoom
      //
      //}

      console.log(json)
      findCurrentTalksJSON(json)

    })

}

window.onload = function() {

  updateFromFahrplan('/schedule.json')

}
