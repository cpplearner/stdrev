(function() {
'use strict';
var styles = Object.assign(document.createElement('style'), { className: 'stdrev-styles' });
var not_diff_mode = '[data-stdrev]:not([data-stdrev="DIFF"]) ';
styles.textContent = not_diff_mode+'.stdrev-hidden { display: none !important; }';
styles.textContent += not_diff_mode+'.t-rev-begin > tbody > tr > td { border: none !important; padding: 0 !important; }';
styles.textContent += not_diff_mode+'.t-rev-begin > tbody > tr > td:nth-child(2) { display: none; }';
styles.textContent += not_diff_mode+'.t-rev-inl { border: none; }';
styles.textContent += not_diff_mode+'.t-rev-inl > span > .t-mark-rev { display: none; }';
styles.textContent += 'div.vectorMenu li a.stdrev-inapplicable-rev-option { color: grey; font-style: italic; }';
styles.textContent += 'div.vectorMenu li a.stdrev-selected-rev-option { font-weight: bold; }';
$('head').append(styles);

var is_cxx = mw.config.get('wgTitle').indexOf('c/') !== 0;
var rev = is_cxx ?
	[ 'C++98', 'C++03', 'C++11', 'C++14', 'C++17', 'C++20', 'C++23' ] :
	[ 'C89', 'C99', 'C11', 'C23' ];

var curr_rev = 'DIFF';

var choices = ['DIFF'].concat(rev);

// Returns true if an element should be shown in the current revision, that is, either curr_rev is
// DIFF (i.e. show all), or curr_rev is within the range [since, until). The range [since, until)
// is inspected from the classes of `el`.
// `el` may be the same element as the one to be shown if it has the needed classes, or it may be a
// revision marker or a collection thereof (e.g. one produced by {{mark since foo}}, or from the
// {{mark since foo}}{{mark until bar}} combo).
// `el` may be either a HTML element or a jQuery object.
// Note that this correctly handle the case when `el` contains nothing (in which case the element
// is always shown).
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

// Hide `el` if `cond` is true. `el` may be a HTML element or a jQuery object.
function hide_if(el, cond) { $(el).toggleClass('stdrev-hidden', cond); }

// Returns true if the jQuery object `el` contains at least one element.
function is_present(el) { return $(el).length > 0; }

// Returns true if the jQuery object `el` contains at least one element, and all contained elements
// are hidden; otherwise returns false.
// This is used to hide a 'parent' or 'heading' element when all its contents are hidden.
function all_hidden(el) { return is_present(el) && !$(el).is(':not(.stdrev-hidden)'); }

// Called when user changes the selected revision. Inside this function, curr_rev is already set to
// the value after the change.
function on_rev_changed() {
	handle_dcl();
	hide_rev_mark_in_dcl();
	renumber_dcl();
	handle_par();
	handle_dsc();
	handle_nv();
	handle_rev();
	handle_member();
	handle_headings();
	handle_list_items();
	$('body').attr('data-stdrev', curr_rev);
}

// Hide or show the elements produced by the {{dcl ...}} template family. See documentation at
// https://en.cppreference.com/w/Template:dcl/doc .
// The dcl items (produced by {{dcl | ... }}) may either appear alone or as children of versioned
// declaration list (produced by {{dcl rev begin | ... }}). In the latter case, the revision may
// be supplied by the dcl items or by the dcl-rev (in the latter case the dcl-rev has class
// t-dcl-rev-notes).
// When {{dcl rev begin | ... }} is in use, the elements produced by {{dcl header | ... }} and
// {{dcl h | ... }} might not be adjacent to their associated dcl items in DOM.
// For convenience, each dcl-rev is marked as hidden if all its children dcl items are hidden,
// and vice versa.
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
	var heading_selector = ['.t-dcl-h', '.t-dcl-begin .t-dsc-header'];
	$.each(heading_selector, function(i, selector) {
		$(selector).each(function() {
			var headings = heading_selector.slice(i).join(',');
			var lastheading = $(this).nextUntil(':not('+headings+')').addBack().last();
			var elts = lastheading.nextUntil(headings).filter('.t-dcl');
			if (! is_present(lastheading.nextAll(headings))) {
				var dcl_revs = $(this).closest('tbody').nextUntil(':has('+headings+')');
				var dcls = dcl_revs.next().find(headings).first().prevAll('.t-dcl');
				elts = elts.add(dcl_revs.find('.t-dcl')).add(dcls);
			}
			hide_if(this, all_hidden(elts));
		});
	});
	$('.t-dcl-begin .t-dsc-header').each(function() {
		var marker = $(this).find('> td > div > .t-mark-rev');
		hide_if(this, all_hidden(this) || !should_be_shown(marker));
	});
}
// Hide revision markers in each dcl. Currently, a marker is hidden only if the associated
// declaration replaces or is replaced with another declaration, because the markers seem
// misleading in this case: the declaration is only updated, not added or removed.
// Markers are never hidden otherwise. In particular, if no replacement is declared, the markers
// are not hidden.
// This treatment might seem subtle, but hopefully it is more helpful than always showing
// the markers.
// Requires that handle_dcl() has been called.
function hide_rev_mark_in_dcl() {
	$('.t-dcl-rev > .t-dcl').each(function() {
		var marker = $(this).find('> td > .t-mark-rev');
		hide_if(marker.filter('[class*=" t-since-"]'), all_hidden($(this).prev()));
		hide_if(marker.filter('[class*=" t-until-"]'), all_hidden($(this).next()));
	});
}
// Ensure that visible dcl items in a dcl list are contiguously numbered, and rewrite mentions
// of these numbers to use the modified numbering.
// A list item (e.g. those produced by @m@) is hidden if it contains no number after the rewrite
// (i.e. it's inapplicable in current revision).
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
				if (! match) return;
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
			if ($(this).is('.t-v')) {
				$(this).text('('+s.join(',')+')');
			} else if ($(this).attr('data-orig-v') !== '') {
				hide_if(this.parentElement, !is_present(numbers));
				$(this).text(s.join(',')+')');
			} else {
				var prev_li = $(this).prevAll('.t-li:not([data-orig-v=""])').last();
				hide_if(this.parentElement, all_hidden(prev_li));
			}
		});
	});
}
// Hide or show the elements produced by the {{par ...}} template family. See documentation at
// https://en.cppreference.com/w/Template:par/doc .
// A parameter is hidden if its name only appears in hidden dcl items of the preceding dcl list.
// Only characters matching [a-zA-Z0-9_] are considered to be part of the name. In particular,
// ellipses and Greek characters are not considered (even though the latter are identifiers).
// Syntactic parameters (produced by {{spar ...}}) are not handled for now.
// Requires that handle_dcl() has been called.
function handle_par() {
	$('.t-par-begin').each(function() {
		var dcls = $(this).prevAll('.t-dcl-begin').last().find('.t-dcl');
		$(this).find('.t-par').each(function() {
			if ($(this).is(':has(> td:first-child > *)'))
				return;
			var names = $(this).children('td:first-child').text();
			if (names) {
				var filtered_names = $.grep(names.split(','), function(v) {
					if (v.search(/\w/g) === -1) return true;
					var rname = new RegExp('\\b'+v.replace(/\W/g, '')+'\\b');
					var matched_dcls = dcls.find('> td:first-child').filter(function() {
						return $(this).text().search(rname) !== -1;
					});
					return !all_hidden(matched_dcls);
				});
				hide_if(this, !is_present(filtered_names));
			}
		});
	});
}
// Hide or show the elements produced by the {{dsc ...}} template family. See documentation at
// https://en.cppreference.com/w/Template:dsc/doc .
// The revision markers are in the first cell of each dsc item. In the general case, the visibility
// of a dsc item is control by a single revision marker. But if a specialized template is used,
// and there are as many entity names in the first cell as the lines of the revision markers,
// then each line controls the visibility of a single entity name, and the dsc item is hidden only
// if all the entity names are hidden.
// If all the dsc items are hidden, then the corresponding headings are hidden as well.
function handle_dsc() {
	$('.t-dsc').each(function() {
		var member = $(this).find('.t-dsc-member-div');
		if (is_present(member)) {
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
// Hide or show the navbar elements produced by the {{nv ...}} template family. See documentation
// at https://en.cppreference.com/w/Template:nv/doc .
// A revision marker controls only a single name, even if the nv element is produced by
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
			if (is_present(marker)) {
				section.each(function() {
					if ($(this).is('.t-nv, .t-nv-ln-table'))
						hide_if(this, all_hidden(this) || !should_be_shown(marker));
					else
						hide_if(this, !should_be_shown(marker));
				});
				hide_if(this, !should_be_shown(marker));
			} else {
				hide_if(this, all_hidden(section.find('.t-nv-ln-table')));
			}
		});
	});
}
// Hide or show the elements produced by the {{rev ...}} template family. See documentation at
// https://en.cppreference.com/w/Template:rev/doc .
// Borders are handled by class stdrev-rev-hide.
function handle_rev() {
	$('.t-rev, .t-rev-inl').each(function() {
		hide_if(this, !should_be_shown(this));
	});
}
// Hide or show in-line member description block produced by {{member}}.
// A block is hidden if all its declarations are hidden.
// Requires that handle_dcl has been called.
function handle_member() {
	$('.t-member').each(function() {
		hide_if(this, all_hidden($(this).find('.t-dcl')));
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
			if (is_present(marker)) {
				section.each(function() {
					hide_if(this, all_hidden(this) || !should_be_shown(marker));
				});
				hide_if(this, !should_be_shown(marker));
			} else if (section.is('.t-dsc-begin')) {
				if (!section.is(':not(p, .t-rev-begin, .t-dsc-begin)')) {
					var content = section.find('.t-dsc, .t-rev, .t-rev-inl');
					var hidden = all_hidden(content);
					section.not(content).each(function() {
						hide_if(this, hidden);
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

function init() {
	// create revision select
	var select = $('<div class="vectorMenu"></div>').appendTo('#cpp-head-tools-right');
	select.append('<h5><span>Std rev</span></h5>');
	var list = $('<ul>').appendTo($('<div class="menu">').appendTo(select));
	$.each(choices, function(i, v) {
		list.append('<li><a href="#'+v+'">'+v+'</a></li>');
	});
	list.find('a').on('click', function(e) {
		list.find('a').removeClass('stdrev-selected-rev-option');
		$(this).addClass('stdrev-selected-rev-option');
		curr_rev = e.target.innerText;
		on_rev_changed();
		if (mw.config.get('wgAction') === 'view' && mw.config.get('wgNamespaceNumber') === 0)
			localStorage[is_cxx ? 'stdrev.cxx' : 'stdrev.c'] = curr_rev;
		return false;
	});

	// grey out options that appear inapplicable, based on the heading and the dcl lists (if any).
	$.each(rev, function(i, v) {
		var rev_is_applicable = true;
		curr_rev = v;
		var marker = $('#firstHeading > .t-mark-rev');
		if (is_present(marker)) {
			rev_is_applicable = should_be_shown(marker);
		} else {
			var dcl_cont = $('.t-dcl-begin:not(h3 ~ *, .t-member *)');
			var dcl = dcl_cont.find('.t-dcl-rev-notes, .t-dcl:not(.t-dcl-rev-notes *)');
			if (is_present(dcl) && !dcl.is(':not(:has(.t-mark-rev))'))
				rev_is_applicable = dcl.is(function() { return should_be_shown(this) });
		}
		if (! rev_is_applicable)
			list.find('a[href="#'+curr_rev+'"]').addClass('stdrev-inapplicable-rev-option');
	});

	// select the previously selected revision
	if (mw.config.get('wgAction') === 'view' && mw.config.get('wgNamespaceNumber') === 0) {
		curr_rev = localStorage[is_cxx ? 'stdrev.cxx' : 'stdrev.c'];
		if (! list.find('a[href="#'+curr_rev+'"]').is('.stdrev-inapplicable-rev-option'))
			list.find('a[href="#'+curr_rev+'"]').triggerHandler('click');
	}
}

init();

})();
