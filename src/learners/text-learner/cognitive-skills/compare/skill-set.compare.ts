import * as confirms from './skill.confirms'
import * as contradicts from './skill.contradicts'
import * as extendsSkill from './skill.extends'
import * as newSkill from './skill.new'
import * as irrelevant from './skill.irrelevant'

export const skillSet = {
	name: 'compare',
	question: 'How does this new information relate to my existing understanding?',
}

export const skills = {
	confirms,
	contradicts,
	extends: extendsSkill,
	new: newSkill,
	irrelevant,
}
