
var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
if (isSafari) {
  document.write('<div class="warning">Safari/iOS doesn\'t work yet. Know your way around AudioContext with Safari? <a href="mailto&#58;win&#37;6Be&#108;%73%&#52;0c&#97;m&#112;u&#115;&#46;t%&#55;5-&#37;62&#101;r%6C%69&#37;6&#69;&#46;&#37;&#54;4e">Contact us</a>.</div>')
}

var syslang = navigator.language.split('-')[0]

window.switchLang = function(lang) {
  let body = document.getElementsByTagName('body')[0];
  body.setAttribute('data-lang', lang);
  let langElements = body.querySelectorAll('[data-lang]');
  for (let langElement of langElements) {
	var elLang = langElement.getAttribute('data-lang');
	var classes = langElement.classList;
	classes.remove('current');
	if (elLang == lang) {
	  classes.add('current');
	}
  }
}
switchLang(syslang);

