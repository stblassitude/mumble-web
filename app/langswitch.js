/*
var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
if (isSafari) {
	document.write('<div class="warning">Safari/iOS doesn\'t work yet. Know your way around AudioContext with Safari? <a href="mailto&#58;win&#37;6Be&#108;%73%&#52;0c&#97;m&#112;u&#115;&#46;t%&#55;5-&#37;62&#101;r%6C%69&#37;6&#69;&#46;&#37;&#54;4e">Contact us</a>.</div>');
}
*/

window.switchLang = function(lang) {

	localStorage.setItem('lang', lang);
	document.body.lang = lang;

}

function initLang() {

	// is there a set preferred language?
	let lang = localStorage.getItem('lang');

	// otherwise, check the system language
	if (!lang) {
		lang = navigator.language.split('-')[0];
	}

	// If translated texts for this language exist, set the attribute
	if (document.querySelector('[data-lang='+lang+']')) {
		switchLang(lang);
	}

	// otherwise, keep showing all languages

}

initLang();
