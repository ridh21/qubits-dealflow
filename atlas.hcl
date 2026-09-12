// Atlas config — visualize the Prisma schema with:
//   atlas schema inspect --env local --url env://src -w
data "external_schema" "prisma" {
  program = [
    "npx", "prisma", "migrate", "diff",
    "--from-empty",
    "--to-schema-datamodel", "prisma/schema.prisma",
    "--script"
  ]
}

env "local" {
  src = data.external_schema.prisma.url
  dev = "docker://postgres/16-alpine/dev?search_path=public"
}
