" Vim syntax file
" Language:	lint ignore file
" Maintainer:	Corey Hart <corey@codenothing.com>
" Filenames:	.lintignore
" Last Change:	[DATE]

if exists("b:current_syntax")
    finish
endif

setlocal iskeyword+=-
setlocal iskeyword-=_
syn case ignore
syn sync minlines=10

syn match   lintignoreComment	"[#;].*"

hi def link lintignoreComment		Comment

let b:current_syntax = "lintignore"
