/* Display-only labels. Never shorten or rewrite the saved project document. */
(function(scope){
  'use strict';
  const asText=value=>typeof value==='string'?value:'';
  const cjk=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
  const segmenter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
  const graphemes=value=>segmenter?Array.from(segmenter.segment(value),part=>part.segment):Array.from(value);
  function plain(value){
    return asText(value).replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
      .replace(/\*\*|__|`+/g,'').replace(/^\s*#{1,6}\s+/,'').replace(/^\s*(?:>\s*)+/,'')
      .replace(/\s+/g,' ').trim();
  }
  function withoutShotProlog(value){
    let text=plain(value);
    text=text.replace(/^\s*(?:\d{1,3}[.)．]\s+|\d{1,3}、\s*)/,'');
    text=text.replace(/^\s*\[?\s*(?:\d{1,2}:)?\d{1,3}(?:\.\d+)?\s*(?:秒|s|sec(?:onds)?)?\s*[–—~～-]\s*(?:\d{1,2}:)?\d{1,3}(?:\.\d+)?\s*(?:秒|s|sec(?:onds)?)?\s*\]?\s*[|｜:：·-]*\s*/i,'');
    text=text.replace(/^(?:(?:镜头|鏡頭|ショット|숏|샷|shot)\s*\d{1,4}|(?:V\d+[_-])?S\d+)\s*[|｜:：·-]*\s*/i,'');
    // A lens-led technical header is identifiable; discard only that header,
    // not an arbitrary narrative sentence or any saved content.
    if(/^\d{1,3}(?:\.\d+)?\s*mm/i.test(text)){
      const end=text.search(/[。!?！?]/);
      if(end>=0&&end<150&&text.slice(end+1).trim())text=text.slice(end+1).trim();
      else text=text.replace(/^\d{1,3}(?:\.\d+)?\s*mm\s*/i,'');
    }
    return text.replace(/^[|｜:：·\s]+/,'').trim();
  }
  function compact(value,{kind='label',fallback='',limit}={}){
    const raw=asText(value);
    let text=kind==='shot'?withoutShotProlog(raw):plain(raw);
    if(!text)text=asText(fallback);
    const maximum=limit??(cjk.test(text)?(kind==='project'?24:18):(kind==='project'?56:44));
    const points=graphemes(text);
    if(points.length>maximum&&kind==='shot'){
      const clause=text.split(/[，,；;。！？!?]/)[0].trim();
      if(clause)text=clause;
    }
    let units=graphemes(text);
    if(units.length>maximum){
      text=units.slice(0,maximum-1).join('');
      if(!cjk.test(text)&&/\s/.test(text))text=text.replace(/\s+\S*$/,'');
      text=text.trimEnd()+'…';
    }
    return {text,full:raw,abbreviated:text!==raw.trim()};
  }
  function breadcrumb(parts){
    const result=[];let previous='';
    for(const part of parts){const value=plain(part);if(!value)continue;const key=value.toLocaleLowerCase();if(key!==previous)result.push(value);previous=key;}
    return result.join(' / ');
  }
  scope.StageNaming={compact,breadcrumb,plain};
})(typeof window!=='undefined'?window:globalThis);
