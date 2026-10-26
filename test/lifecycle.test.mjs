import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { Window } from 'happy-dom'
const require = createRequire(import.meta.url)
const { GlassStyle, STYLE_ID } = require('../.build/style.js')
const css = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8')

test('enable/update/disable preserves foreign styles and removes only owned DOM state', () => {
    const window = new Window(), doc = window.document
    doc.head.innerHTML = '<style id="custom-css">body{color:red}</style>'
    const style = new GlassStyle(doc, css)
    style.update({ enabled: true, radius: 18, opacity: 80 })
    style.update({ enabled: true, radius: 8, opacity: 100 })
    assert.equal(doc.querySelectorAll(`#${STYLE_ID}`).length, 1)
    assert.equal(doc.body.hasAttribute('data-liquid-glass-theme'), true)
    assert.match(doc.getElementById(STYLE_ID).textContent, /--gg-radius:8px/)
    assert.ok(doc.getElementById(STYLE_ID).sheet.cssRules.length > 20)
    style.update({ enabled: false })
    assert.equal(doc.getElementById(STYLE_ID), null)
    assert.equal(doc.body.hasAttribute('data-liquid-glass-theme'), false)
    assert.equal(doc.getElementById('custom-css').textContent, 'body{color:red}')
    style.destroy()
})

test('pane rounding and independent divider paint share radius without reducing hit area', () => {
    const window = new Window(), doc = window.document
    doc.body.innerHTML = '<app-root><split-tab><div class="child"></div><split-tab-spanner class="h"></split-tab-spanner></split-tab></app-root>'
    const style = new GlassStyle(doc, css)
    style.update({ enabled: true, radius: 20, opacity: 100 })
    const rules = [...doc.getElementById(STYLE_ID).sheet.cssRules]
    const divider = rules.find(r => r.selectorText?.includes('split-tab-spanner.h::after'))
    assert.equal(divider.style.getPropertyValue('top'), 'var(--gg-radius)')
    assert.equal(divider.style.getPropertyValue('bottom'), 'var(--gg-radius)')
    const pane = rules.find(r => r.selectorText?.includes('.child:not(.minimized)'))
    assert.equal(pane.style.getPropertyValue('border-radius'), 'var(--gg-radius)')
    assert.equal(rules.some(r => r.selectorText?.endsWith('split-tab-spanner.h')), false)
    style.destroy()
})
