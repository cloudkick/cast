var E           = require('../exceptions')
  , getProto    = Object.getPrototypeOf
  , isArray     = Array.isArray;

exports['for'] = FOR;

/**
 * This is a for tag, like in Django:
 * {% for val in vals %} ... {% endfor %}
 */
var validForParamRegex = /^(\w+) *(, *(\w+))? +in +(\w+([.]\w+)*)$/;
function FOR( params, parent ) {
  var matches;
  if( !( matches = params.match(validForParamRegex) ) )
    throw new E.TSE( "Invalid 'for' tag syntax: '%s'".fmt(params) );
  
  this.var1   = matches[1], 
  this.var2   = matches[3], 
  this.lookup = matches[4];
  
  if( !isNaN( +this.var1 ) || (this.var2 && !isNaN( +this.var2 )) || !isNaN( +this.lookup ) )
    throw new E.TSE( "Invalid variable names in '{% for %s %}'".fmt(params) );
  
  this.tagname  = "for";
}

FOR.renderFunction = function( context ){
  var iter, i, j=0, r
    , ctx = { forloop:{} }
    , output = []
    , var1 = this.var1
    , var2 = this.var2
    , lookup = this.lookup
    , render = getProto(this).render;
  
  if( !( iter = context.getPath( lookup ) ) )
    return ""; // iterable not found; render nothing
  
  context.push( ctx );
  
  if( isArray( iter ) )
    for( i=0, j=iter.length; i<j; ++i ) {
      ctx[ var1 ] = iter[ i ];
      var2 && ( ctx[ var2 ] = i );
      output = output.concat( render.call( this, context ) );
    }
    
  else if( typeof iter === 'object' )
  
    for( i in iter ) {
      if( !iter.hasOwnProperty(i) ) continue;
      ctx[ var1 ] = iter[ i ];
      var2 && ( ctx[ var2 ] = i );
      output = output.concat( render.call( this, context ) );
    }
    
  else if( typeof iter === 'string' )
  
   for( i in iter ) {
     ctx[ var1 ] = iter[ i ];
     var2 && ( ctx[ var2 ] = j++ );
     output = output.concat( render.call( this, context ) );
   }
   
  else throw new E.TE( "'%s' is not a valid variable for looping".fmt( lookup ) );

  context.pop();
  return output; 
}

FOR.expectsClosing = true;