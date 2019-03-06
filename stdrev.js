(function() {
'use strict';
var styles = document.createElement('style');
styles.textContent = '.stdrev-hidden { display: none !important; }';
styles.textContent += '.stdrev-rev-hide > tbody > tr > td { border: none !important; padding: 0 !important; }'
styles.textContent += '.stdrev-rev-hide > tbody > tr > td:nth-child(2) { display: none; }'
styles.textContent += '.stdrev-rev-hide { border: none; }'
styles.textContent += '.stdrev-rev-hide > span > .t-mark-rev { display: none; }'
document.head.append(styles);

var rev = mw.config.get('wgTitle').indexOf('c/') === 0 ?
	[ 'C89', 'C99', 'C11' ] :
	[ 'C++98', 'C++03', 'C++11', 'C++14', 'C++17', 'C++20' ];

var curr_rev = 'DIFF';

// Returns true if an element should be shown in the current revision, that is, either curr_rev is
// DIFF (i.e. show all), or curr_rev is within the range [since, until). The range [since, until)
// is inspected from the classes of `el`.
// `el` may be the same element as the one to be shown if it has the needed classes, or it may be a
// revision marker or a collection thereof (e.g. one expanded from {{mark since foo}}, or from the
// {{mark since foo}}{{mark until bar}} combo).
// `el` may be either a HTML element or a jQuery object.
// Note that this correctly handle the case when `el` represents an empty set of elements (in which
// case the element is always shown).
function should_be_shown(el) {
	if (curr_rev === 'DIFF') return true;
	var curr_revid = rev.indexOf(curr_rev);
	var since = 0, until = rev.length;
	$.each(rev, function(i) {
		var ssince = 't-since-'+rev[i].toLowerCase().replace(/\+/g, 'x');
		var suntil = 't-until-'+rev[i].toLowerCase().replace(/\+/g, 'x');
		if ($(el).hasClass(ssince)) since = i;
		if ($(el).hasClass(suntil)) until = i;
	});
	return since <= curr_revid && curr_revid < until;
}

// Hide `el` if `cond` is true. `el` should be a HTML element.
function hide_if(el, cond) { $(el).toggleClass('stdrev-hidden', cond); }

// Returns true if the jQuery object `el` contains at least one element, and all contained elements
// are hidden; otherwise returns false.
// This is used to hide a 'parent' or 'heading' element when all its contents are hidden.
function all_hidden(el) { return $(el).length > 0 && !$(el).is(':not(.stdrev-hidden)'); }

// Called when user changes the selected revision. Inside this function, curr_rev is already set to
// the value after the change.
function on_rev_changed() {
	handle_dcl();
	renumber_dcl();
	handle_par();
	handle_dsc();
	handle_nv();
	handle_rev();
	handle_headings();
	handle_list_items();
	$('.t-rev-begin, .t-rev-inl').toggleClass('stdrev-rev-hide', curr_rev !== 'DIFF');
	$('.t-mark-rev').each(function() {
		hide_if(this, curr_rev !== 'DIFF');
	});
}

// Hide or show the elements expanded from the {{dcl ...}} template family. See documentation at
// https://en.cppreference.com/w/Template:dcl/doc .
// The dcl items (expanded from {{dcl | ... }}) may either appear alone or as children of versioned
// declaration list (expanded from {{dcl rev begin | ... }}). In the latter case, the revision may
// be supplied by the dcl items or by the dcl-rev (in the latter case the dcl-rev has class
// t-dcl-rev-notes).
// For the use of renumber_dcl(), each dcl-rev is marked as hidden if all its children dcl items
// are hidden, and vice versa.
function handle_dcl() {
	$('.t-dcl').each(function() {
		hide_if(this, !should_be_shown(this));
	});
	$('.t-dcl-rev').each(function() {
		if ($(this).is('.t-dcl-rev-notes')) {
			var hidden = !should_be_shown(this);
			hide_if(this, hidden);
			$(this).find('.t-dcl').each(function() {
				hide_if(this, hidden);
			});
		} else {
			hide_if(this, all_hidden($(this).find('.t-dcl')));
		}
	});
	$('.t-dcl-begin .t-dsc-header').each(function() {
		var marker = $(this).find('> td > div > .t-mark-rev');
		var lastheader = $(this).nextUntil(':not(.t-dsc-header)').addBack();
		var elts = lastheader.nextUntil('.t-dsc-header').filter('.t-dcl, .t-dcl-rev');
		hide_if(this, all_hidden(elts) || !should_be_shown(marker));
	});
	$('.t-dcl-h').each(function() {
		hide_if(this, all_hidden($(this).nextUntil(':not(.t-dcl, .t-dcl-rev)')));
	});
}

// Ensure that each visible dcl item in a dcl list is contiguously numbered, and rewrite mentions
// to these numbers to use the modified numbering.
// If a list item (e.g. those expanded from @m@) contains no number after the rewrite (i.e. it's
// inapplicable in current revision), it is hidden.
// Note that the use of '~ * .t-li, ~ * .t-v' effectively establishes a kind of scoping: only
// numbers that appear after the dcl list and are more nested in the DOM hierarchy are affected
// by the renumbering.
// Requires that handle_dcl() has been called.
function renumber_dcl() {
	$('.t-dcl-begin').each(function() {
		var numbering_map = [];
		var i = 0;
		$(this).find('.t-dcl, .t-dcl-rev').each(function() {
			var num_cell;
			if ($(this).is('.t-dcl'))
				num_cell = $(this).children('td:nth-child(2)');
			else
				num_cell = $(this).find('> tr.t-dcl-rev-aux > td:nth-child(2)');
			var number_text = /\s*\((\d+)\)\s*/.exec(num_cell.text());
			if (!num_cell.attr('data-orig-num') && number_text)
				num_cell.attr('data-orig-num', number_text[1]);
			var original_num = num_cell.attr('data-orig-num');
			if (original_num) {
				if (! numbering_map[original_num])
					numbering_map[original_num] = all_hidden(this) ? null : ++i;
				num_cell.text('('+numbering_map[original_num]+')');
			}
		});
		$(this).find('~ * .t-li, ~ * .t-v').each(function() {
			if (! $(this).attr('data-orig-v'))
				$(this).attr('data-orig-v', $(this).text().replace(/[()]/g, ''));
			var original_numbers = [];
			$.each($(this).attr('data-orig-v').split(','), function(i, v) {
				var match = /(\d+)(?:-(\d+))?/.exec(v);
				if (match[2])
					for (var i = +match[1]; +i <= +match[2]; ++i)
						original_numbers.push(i);
				else
					original_numbers.push(match[1]);
			});
			var numbers = $.map(original_numbers, function(x) {
				return numbering_map[x];
			});
			var s = [];
			for (var i = 0; i < numbers.length; ++i) {
				if (numbers[i+1] - numbers[i] === 1 && numbers[i+2] - numbers[i+1] === 1) {
					var begin = numbers[i];
					while (numbers[i+1] - numbers[i] === 1)
						++i;
					s.push(begin+'-'+numbers[i]);
				} else {
					s.push(numbers[i]);
				}
			}
			if ($(this).is('.t-li')) {
				hide_if(this.parentElement, numbers.length === 0);
				$(this).text(s.join(',')+')');
			} else
				$(this).text('('+s.join(',')+')');
		});
	});
}
// Hide or show the elements expanded from the {{par ...}} template family. See documentation at
// https://en.cppreference.com/w/Template:par/doc .
// A parameter is hidden if its name only appears in hidden dcl items of the preceding dcl list.
// Only characters matching [a-zA-Z0-9_] are considered to be part of the name. In particular,
// ellipses and Greek characters are not considered (even though the latter are identifiers).
// Syntactic parameters (expanded from {{spar ...}}) are not handled for now.
// Requires that handle_dcl() has been called.
function handle_par() {
	$('.t-par-begin').each(function() {
		var dcls = $(this).prevAll('.t-dcl-begin').last().find('.t-dcl > td:first-child');
		$(this).find('.t-par').each(function() {
			if (!$(this).attr('data-orig-names') && !$(this).is(':has(> td:first-child > *)')) {
				var names = $(this).children('td:first-child').text();
				$(this).attr('data-orig-names', names);
			}
			var names = $(this).attr('data-orig-names');
			if (names) {
				var filtered_names = $.grep(names.split(','), function(v) {
					if (v.search(/\w/g) === -1) return true;
					var rname = new RegExp('\\b'+v.replace(/\W/g, '')+'\\b');
					var matched_dcls = dcls.filter(function() {
						return $(this).text().search(rname) !== -1;
					});
					return !all_hidden(matched_dcls.parent());
				});
				hide_if(this, filtered_names.length === 0);
			}
		});
	});
}
// Hide or show the elements expanded from the {{dsc ...}} template family. See documentation at
// https://en.cppreference.com/w/Template:dcl/doc .
// The revision markers are in the first cell of each dsc item. In the general case, the visibility
// of a dsc item is control by a single revision marker. But if a specialized template is used,
// and the amount of entity names in the first cell matches the lines of the revision markers,
// then each line controls the visibility of a single entity name, and the dsc item is hidden only
// if all the entity names are hidden.
// If all the dsc items are hidden, then the corresponding headings are hidden as well.
function handle_dsc() {
	$('.t-dsc').each(function() {
		var member = $(this).find('.t-dsc-member-div');
		if (member[0]) {
			var lines = member.find('> div:nth-child(2) > .t-lines').children();
			var mems = member.find('> div:first-child .t-lines').children();
			if (lines.length !== mems.length)
				hide_if(this, !should_be_shown(lines.children('.t-mark-rev')));
			else {
				lines.each(function(i) {
					var marker = $(this).children('.t-mark-rev');
					hide_if(mems[i], !should_be_shown(marker));
					hide_if(marker, !should_be_shown(marker));
				});
				hide_if(this, all_hidden(mems));
			}
		} else {
			var marker = $(this).find('> td:first-child > .t-mark-rev');
			hide_if(this, !should_be_shown(marker));
		}
	});
	$('.t-dsc-begin .t-dsc-header').each(function() {
		var marker = $(this).find('> td > div > .t-mark-rev');
		var headers = $(this).nextUntil(':not(.t-dsc-header)').addBack();
		hide_if(this, all_hidden(headers.nextUntil(':not(.t-dsc)')) || !should_be_shown(marker));
	});
	var heading_selector = ['tr:has(> td > h5)', 'tr:has(> td > h3)'];
	$.each(heading_selector, function(i, selector) {
		$(selector).each(function() {
			var section = $(this).nextUntil(heading_selector.slice(i).join(','));
			hide_if(this, all_hidden(section.filter('.t-dsc')));
		});
	});
	$('.t-dsc-begin').each(function() {
		hide_if(this, all_hidden($(this).find('.t-dsc')));
	});
}
// Hide or show the navbar elements expanded from the {{nv ...}} template family. See documentation
// at https://en.cppreference.com/w/Template:nv/doc .
// A line of revision marker only controls a single entity name, even if it's expanded from
// {{nv ln | ... }} that contains multiple lines.
// If a heading contains a revision marker, that revision marker controls the visibility of the
// heading and its corresponding contents; otherwise the heading is hidden when it is followed by
// content elements, and all of them are hidden.
function handle_nv() {
	$('.t-nv').each(function() {
		var marker = $(this).find('> td > .t-mark-rev');
		hide_if(this, !should_be_shown(marker));
	});
	$('.t-nv-ln-table').each(function() {
		var lines = $(this).find('> div:nth-child(2) > .t-lines').children();
		var mems = $(this).find('> div:first-child .t-lines').children();
		lines.each(function(i) {
			var marker = $(this).children('.t-mark-rev');
			if (mems[i]) hide_if(mems[i], !should_be_shown(marker));
			hide_if(marker, !should_be_shown(marker));
		});
		hide_if(this, all_hidden(mems));
	});
	var heading_selector = ['.t-nv-h2', '.t-nv-h1'];
	$.each(heading_selector, function(i, selector) {
		$(selector).each(function() {
			var section = $(this).nextUntil(heading_selector.slice(i).join(','));
			var marker = $(this).find('> td > .t-mark-rev');
			if (marker[0]) {
				section.each(function() {
					hide_if(this, all_hidden(this) || !should_be_shown(marker));
				});
				hide_if(this, !should_be_shown(marker));
			} else {
				hide_if(this, all_hidden(section.find('.t-nv-ln-table')));
			}
		});
	});
}
// Hide or show the elements expanded from the {{rev ...}} template family. See documentation at
// https://en.cppreference.com/w/Template:dcl/doc .
// Borders are handled by class stdrev-rev-hide.
function handle_rev() {
	$('.t-rev, .t-rev-inl').each(function() {
		hide_if(this, !should_be_shown(this));
	});
}
// Hide or show headings.
// If the heading contains a revision marker, that revision marker controls the visibility of it
// and its corresponding contents; otherwise, a heuristic is made: if the contents contain a dsc
// list, and its revision-related contents are hidden, then the heading and all contents are hidden
// as well.
// The heuristic requires that handle_dsc() and handle_rev() have been called.
function handle_headings() {
	var heading_selector = ['h5', 'h4', 'h3', 'h2'];
	$.each(heading_selector, function(i, selector) {
		$(selector).each(function() {
			var section = $(this).nextUntil(heading_selector.slice(i).join(','));
			var marker = $(this).find('> span > .t-mark-rev');
			if (marker[0]) {
				section.each(function() {
					hide_if(this, all_hidden(this) || !should_be_shown(marker));
				});
				hide_if(this, !should_be_shown(marker));
			} else if (section.is('.t-dsc-begin')) {
				if (!section.is(':not(p, .t-rev-begin, .t-dsc-begin)')) {
					var content = section.find('.t-dsc, .t-rev, .t-rev-inl');
					var hidden = all_hidden(content);
					section.each(function() {
						hide_if(this, all_hidden(this) || hidden);
					});
					hide_if(this, hidden);
				}
			}
		});
	});
}
// Hide or show <li> elements based on the contained revision markers.
function handle_list_items() {
	$('li').each(function() {
		var marker = $(this).children('.t-mark-rev');
		hide_if(this, !should_be_shown(marker));
	});
}

var select = $('<div class="vectorMenu"></div>').appendTo('#cpp-head-tools-right');
select.append('<h5><span>Std rev</span></h5>');
var list = $('<ul>').appendTo($('<div class="menu">').appendTo(select));
$.each(['DIFF'].concat(rev), function(i, v) {
	list.append('<li><a href="#'+v+'">'+v+'</a></li>');
});
list.find('a').on('click', function(e) {
	list.find('a').css('font-weight', 'normal');
	$(this).css('font-weight', 'bold');
	curr_rev = e.target.innerText;
	on_rev_changed();
	if (mw.config.get('wgAction') === 'view' && mw.config.get('wgNamespaceNumber') === 0)
		localStorage['stdrev'] = curr_rev;
});

$.each(rev, function(i, v) {
	curr_rev = v;
	var marker = $('#firstHeading > .t-mark-rev');
	if (! marker[0])
		marker = $('.t-dsc-begin:not(h3 ~ *) .t-mark-rev');
	if (! should_be_shown(marker))
		list.find('a[href="#'+rev+'"]').css('color', 'grey');
});

if (mw.config.get('wgAction') === 'view' && mw.config.get('wgNamespaceNumber') === 0) {
	curr_rev = localStorage['stdrev'];
	if (list.find('a[href="#'+curr_rev+'"]').css('color') !== 'grey')
		list.find('a[href="#'+curr_rev+'"]').triggerHandler('click');
}

})();
