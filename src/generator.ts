import camelcase from 'camelcase'
import config from './config'

export type Column = {
  udtName: string
  nullable: boolean
  hasDefault: boolean
  defaultValue: string | null
  comment: string | null
  tsType: string
}

export type Table = {
  [columnName: string]: Column
}

export type TableNonTsType = {
  [columnName: string]: Omit<Column, 'tsType'>
}

function camelize(s: string): string {
  return camelcase(s, { pascalCase: true })
}

function normalize(name: string): string {
  const reservedKeywords = ['string', 'number', 'package']
  let safename = name
  if (reservedKeywords.includes(name)) {
    safename = name + '_'
  }

  return safename
}

export function tableToTS(name: string, prefix: string, table: Table): string {
  const members = (withDefaults: boolean): string[] =>
    Object.keys(table).map((column) => {
      const type = table[column].tsType
      const nullable = table[column].nullable
      const nullablestr = !nullable || (!withDefaults && config.nullAsUndefined) ? '' : '| null'
      const hasDefault = table[column].hasDefault
      const defaultValue = table[column].defaultValue ?? ''
      const defaultComment = withDefaults && hasDefault ? `Defaults to: ${defaultValue}` : ''
      const comment = `${table[column].comment} ${defaultComment}`
      const tsComment = comment.trim().length > 0 ? `\n/** ${comment} */\n` : ''

      const isOptional = withDefaults ? nullable || hasDefault : nullable

      return `${tsComment}${normalize(column)}${
        (withDefaults && isOptional) || (isOptional && (config.nullAsUndefined || config.nullPlusUndefined)) ? '?' : ''
      }: ${type}${nullablestr}\n`
    })

  const tableName = (prefix || '') + camelize(normalize(name))

  return `
    /**
     * Exposes all fields present in ${name} as a typescript
     * type. 
     * This is especially useful for SELECT * FROM
    */
    export ${config.outputAsTypes ? 'type' : 'interface'} ${tableName} ${config.outputAsTypes ? '=' : ''} {
    ${members(false)}
    }

    /**
     * Exposes the same fields as ${tableName},
     * but makes every field containing a DEFAULT value optional.
     *
     * This is especially useful when generating inserts, as you
     * should be able to ommit these fields if you'd like
    */
    export ${config.outputAsTypes ? 'type' : 'interface'} ${tableName}WithDefaults ${config.outputAsTypes ? '=' : ''} {
    ${members(true)}
    }
  `.trim()
}
