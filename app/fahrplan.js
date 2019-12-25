function updateUI(room, day, cday, time, title, started) {

  const el = document.querySelector('#' + room.toLowerCase() + ' .talkinfo')

  const status = started ? 'Since ' : 'Starts '

  const dayInfo = (day != cday) ? `Day ${cday+1}, ` : ''

  el.innerHTML = `
    <span>${status}${dayInfo}${time}</span>
    <h4>${title}</h4>
  `

}

function findCurrentTalks(fp) {

  const now = new Date()

  // switch day over at 4:00 AM
  var dayDate = new Date(now.getTime())
  dayDate.setHours(now.getHours() - 4)

   // 1st day is 27th
  const day = dayDate.getDate() - 27
  const cday = (day >= 0) ? day : 0

  const rooms = fp.schedule.conference.days[cday].rooms
  for (const room in rooms) {

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

function updateFromFahrplan() {

  fetch('/fahrplan.json')
    .then(response => response.json())
    .then(json => findCurrentTalks(json))

}

window.onload = function() {

  updateFromFahrplan()

}
