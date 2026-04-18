import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator } from './i18n.js';

test('createTranslator — returns value for known key in current lang', () => {
  const tr = createTranslator({ en: { greet: 'Hello' }, de: { greet: 'Hallo' } }, 'de');
  assert.equal(tr.t('greet'), 'Hallo');
});

test('createTranslator — falls back to EN when key missing in current lang', () => {
  const tr = createTranslator({ en: { bye: 'Bye' }, de: {} }, 'de');
  assert.equal(tr.t('bye'), 'Bye');
});

test('createTranslator — returns key itself when missing everywhere', () => {
  const tr = createTranslator({ en: {}, de: {} }, 'en');
  assert.equal(tr.t('missing.key'), 'missing.key');
});

test('createTranslator — interpolates {var} placeholders', () => {
  const tr = createTranslator({ en: { hi: 'Hi {name}' } }, 'en');
  assert.equal(tr.t('hi', { name: 'Ada' }), 'Hi Ada');
});

test('createTranslator — leaves unknown vars as empty string', () => {
  const tr = createTranslator({ en: { hi: 'Hi {name}, code {code}' } }, 'en');
  assert.equal(tr.t('hi', { name: 'Ada' }), 'Hi Ada, code ');
});

test('createTranslator — setLang switches active language', () => {
  const tr = createTranslator({ en: { x: 'X-en' }, de: { x: 'X-de' } }, 'en');
  assert.equal(tr.t('x'), 'X-en');
  tr.setLang('de');
  assert.equal(tr.t('x'), 'X-de');
});

test('createTranslator — getLang reflects current language', () => {
  const tr = createTranslator({ en: {} }, 'en');
  assert.equal(tr.getLang(), 'en');
  tr.setLang('de');
  assert.equal(tr.getLang(), 'de');
});

test('createTranslator — falls back to EN when current lang has no bundle at all', () => {
  const tr = createTranslator({ en: { a: 'A' } }, 'fr');
  assert.equal(tr.t('a'), 'A');
});

test('createTranslator — interpolation tolerates missing vars object', () => {
  const tr = createTranslator({ en: { static: 'just text' } }, 'en');
  assert.equal(tr.t('static'), 'just text');
});

test('createTranslator — defaults to en when initialLang omitted', () => {
  const tr = createTranslator({ en: { x: 'X' } });
  assert.equal(tr.getLang(), 'en');
  assert.equal(tr.t('x'), 'X');
});

test('createTranslator — setLang ignores null and undefined', () => {
  const tr = createTranslator({ en: { x: 'X-en' }, de: { x: 'X-de' } }, 'de');
  tr.setLang(null);
  assert.equal(tr.getLang(), 'de');
  tr.setLang(undefined);
  assert.equal(tr.getLang(), 'de');
  assert.equal(tr.t('x'), 'X-de');
});
