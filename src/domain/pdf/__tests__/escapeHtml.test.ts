import { escapeHtml, escapeHtmlMultiline } from '../escapeHtml';

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<b>Nuts & "Bolts" 'Co'</b>`)).toBe(
      '&lt;b&gt;Nuts &amp; &quot;Bolts&quot; &#39;Co&#39;&lt;/b&gt;',
    );
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Acme Corp')).toBe('Acme Corp');
  });
});

describe('escapeHtmlMultiline', () => {
  it('escapes and turns newlines into <br>', () => {
    expect(escapeHtmlMultiline('Line one\nLine <two>')).toBe('Line one<br>Line &lt;two&gt;');
  });
});
