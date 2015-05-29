REPORTER ?= spec
TESTS = $(shell find ./test/* -name "*.test.js")
DIALECT ?= mysql

# test commands

teaser:
	@echo "" && \
	node -pe "Array(20 + '$(DIALECT)'.length + 3).join('#')" && \
	echo '# Running tests for $(DIALECT) #' && \
	node -pe "Array(20 + '$(DIALECT)'.length + 3).join('#')" && \
	echo ''

test:
	@if [ "$$GREP" ]; then \
		make jshint && make teaser && ./node_modules/mocha/bin/mocha --globals setImmediate,clearImmediate --check-leaks --colors -t 10000 --reporter $(REPORTER) -g "$$GREP" $(TESTS); \
	else \
		make jshint && make teaser && ./node_modules/mocha/bin/mocha --globals setImmediate,clearImmediate --check-leaks --colors -t 10000 --reporter $(REPORTER) $(TESTS); \
	fi

jshint:
	./node_modules/.bin/jshint lib test

mariadb:
	@DIALECT=mariadb make test
sqlite:
	@DIALECT=sqlite make test
mysql:
	@DIALECT=mysql make test
mssql:
	@DIALECT=mssql make test
postgres:
	@DIALECT=postgres make test
postgres-native:
	@DIALECT=postgres-native make test

# test aliases

pgsql: postgres
postgresn: postgres-native

# test all the dialects \o/
all: sqlite mysql postgres postgres-native mariadb mssql

.PHONY: sqlite mysql postgres pgsql postgres-native postgresn mssql all test
