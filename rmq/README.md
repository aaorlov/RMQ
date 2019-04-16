# KomGo RabbitMQ cluster

Docker images to run RabbitMQ cluster. It extends the official image with a rabbitmq-cluster script that does the magic.

## Running

In order to setup a local development you need Docker Compose to be installed locally. Then just run the following command:

```
npm start
```

It will setup two RabbitMQ clusters - internal broker (used for internal member node messaging) and common broker (used for messaging between different member and third-party node). 

Apart from the cluster itself, another container called `create-admin` will start and end in order to create the admin user who will replace `guest` by hitting the RabbitMQ API. The credentials are defined in the docker-compose file. 

This way we will store the admin credentials as a password hash instead of a plain password (which is the way by default, for instance for the `guest` user or by changing the RABBITMQ_DEFAULT_USER and PASS).

## Configuration

Current configuration are done like following:

* Internal Node:

    * Admin UI: [http://localhost:15672](http://localhost:15672)
    * Node Port: [http://localhost:5672](http://localhost:5672)

* Common Node:

    * Admin UI: [http://localhost:15673](http://localhost:15673)
    * Node Port: [http://localhost:5673](http://localhost:5673)

## Setting up Exchanges, Queues and their Bindings

*Once the RabbitMQ is up and running*, in order to create the initial setup with user/passwords, you should run the next scripts:

* Member node (Internal MQ):
```
./setup-member.sh
```

    This script will set up:
    * 1 User (organisation)
    * 1 Exchange
    * 1 Queue
    * 1 Binding between Exchange and Queue
    * Permissions to configure and read these specific elements and write (publish messages) in every single element created in other executions of this bash script.

* KOMGO node (Common MQ) - External Party (like VAKT):
```
./setup-komgo.sh
```

    This script will set up:
    * 1 User (organisation)
    * 2 Exchange
    * 2 Queue
    * 2 Binding between Exchanges and Queues
    * Permissions to configure and read these specific elements and write (publish messages) in every single element created in other executions of this bash script.

Four arguments will be requested.

The first two, `admin name` and `admin password`, are the ones needed to make the different calls to the exposed RabbitMQ API endpoints.

The last two are `organisation name` and `password`. The password will be sent to RabbitMQ as a hash following [these guidelines](http://www.rabbitmq.com/passwords.html#computing-password-hash). 

* KOMGO node (Common MQ) - Internal Member:
```
./setup-komgo-internal-member.sh
```

    This script will set up:
    * 1 Exchange
    * 1 Queue
    * 1 Binding between Exchange and Queue

Four arguments will be requested.

The first two, `admin name` and `admin password`, are the ones needed to make the different calls to the exposed RabbitMQ API endpoints.

The last two are `member mnid` and `password`. The password will be sent to RabbitMQ as a hash following [these guidelines](http://www.rabbitmq.com/passwords.html#computing-password-hash). 

## AMQP 0-9-1 Hello World example

*Once the RabbitMQ is up and running*, apart from the features mentioned before, we have added as well an example of usage of the npm module called `amqplib`.

* In order to try `amqplib/callback_api`:
    1. Run `npm install`
    2. Run `npm run start-callback`

* In order to try the regular `amqplib` (promises):
    1. Run `npm install`
    2. Run `npm run start-promise`

This will display in console a sample message received by the consumer and sent by the producer. It will create a Queue called `queue-name` which is bound to the default Exchange (`amq.default`).

## Creating and validating rabbitmq-management plugin patched version

### Building patched binary

First, ensure the following dependencies are installed:
```bash
# Debian
$ sudo apt install curl wget git zip libssl-dev automake autoconf libncurses5-dev

# OSX
# anyone wants to give a go?
```

Then running the `patch-management-plugin.sh`:
```bash
$ cd komgo-member-mq/config/http-length-mod/
$ ./patch-management-plugin.sh

# if everything went well, you can replace current binary with the compiled one
$ ls -la tmp/rabbitmq-management/plugins/rabbitmq_management-*.ez
$ cp tmp/rabbitmq-management/plugins/rabbitmq_management-*.ez plugins/rabbitmq_management_komgo-3.7.8.ez
```

Finally, run the docker container with the new binary from `komgo-member`:
```bash
 $ docker-compose -f docker-compose.rabbitmq-common-alpine.yml up 
```

#### Troubleshooting

While running `patch-management-plugin.sh`, all stateful data is stored under `komgo-member-mq/config/http-length-mod/tmp` like:

- kerl & erlang builds
- exenv & elixir builds
- rabbitmq-management plugin

If `patch-management-plugins.sh` fails and you wish to start all over again, it's safe to delete that `./tmp/` folder or check for known errors/solutions bellow.

Error while building erlang:
```
WARNING: It appears that a required development package 'libssl-dev' is not installed.
WARNING: It appears that a required development package 'automake' is not installed.
WARNING: It appears that a required development package 'autoconf' is not installed.
WARNING: It appears that a required development package 'libncurses5-dev' is not installed.
Configure failed.
checking whether lock counters should be enabled... no
checking whether dlopen() needs to be called before first call to dlerror()... no
checking for kstat_open in -lkstat... (cached) no
checking for tgetent in -ltinfo... no
checking for tgetent in -lncurses... no
checking for tgetent in -lcurses... no
checking for tgetent in -ltermcap... no
checking for tgetent in -ltermlib... no
configure: error: No curses library functions found
configure: error: /bin/bash '/home/vagrant/tmp/.kerl/builds/otp-20.0/otp_src_20.0/erts/configure' failed for erts
```
Solution: install missing dependencies declared above. In debian would be:
```bash
$ sudo apt install libssl-dev automake autoconf libncurses5-dev
```

Error while building erlang:
```
20.0 is not a valid Erlang/OTP release
```
Solution: `rm -rf tmp/.kerl/` and re-run `./patch-management-plugins.sh`

Error while installing erlang:
```
No build named otp-20.0
```
Solution: `rm -rf tmp/.kerl/` and re-run `./patch-management-plugins.sh`

### Validating patched binary

Once docker container for Common MQ is up and running with a patched binary, we can use the validation script - `config/http-length-mod/run_validation.sh` to ensure it allows transferring more than 8000000 bytes. Without the patch, posting a message with a payload higher than that will result in a HTTP response with the code 500. The validation works as follows:

1. Generate RabbitMQ message with a fixed-size and random ascii content payload
2. Ensure that a unique test queue exists - `komgo-2719-http-bigfiles-validation`
3. Ensure that test queue is empty
4. Send generated message to the test queue via HTTP
5. Get message on the head of the test queue via HTTP and save it in a file
6. Extract payload from the received message, calculate `md5sum` and compare with the generated payload sent previously

We can assume the patch is working if we manage to send a file with more that 8000000 bytes AND the random generated payload checksum matches the received payload.

All generated files and received files are kept in `config/http-length-mod/tmp/validation-*`. Example in `in config/http-length-mod/tmp/`:
```bash
$ ls  validation-*
validation-100m-message-received.json  validation-200m-payload-generated.txt
validation-100m-message-sent.json      validation-200m-payload-received.txt
validation-100m-payload-generated.txt  validation-20m-message-received.json
validation-100m-payload-received.txt   validation-20m-message-sent.json
validation-10m-message-received.json   validation-20m-payload-generated.txt
validation-10m-message-sent.json       validation-20m-payload-received.txt
validation-10m-payload-generated.txt   validation-5m-message-received.json
validation-10m-payload-received.txt    validation-5m-message-sent.json
validation-200m-message-received.json  validation-5m-payload-generated.txt
validation-200m-message-sent.json      validation-5m-payload-received.txt
```

From `komgo-member` we can:
```bash
# runs validation with default values:
# payload size: 20MB
# host: http://localhost:15673
# username: KomgoCommonUser
# password: *****
$ komgo-member-mq/config/http-length-mod/run_validation.sh

# run with 200MB payload size
$ komgo-member-mq/config/http-length-mod/run_validation.sh --size 200

# run against a different host with 100MB payload
$ komgo-member-mq/config/http-length-mod/run_validation.sh -s 100 -h "http://commonmq.com:15672" -u "customUser" -p "customPassword"
$ komgo-member-mq/config/http-length-mod/run_validation.sh -s 100 -h https://mq-admin.komgo-dev-re-001.gmk.solutions.consensys-uk.net -u admin -p admin_password_goes_here

```

### Performance testing patched binary

For performance testing, there's a k6 container and a script (`config/http-length-mod/k6-perftest.js`) to stress test our rabbitmq container. It can simulate multiple concurrent users where each:
- send a pre-defined message with a given size to rabbitmq via HTTP
- fetch a message from rabbitmq via HTTP
- ensure fetch message md5 checksum is correct

To run the tests locally you need first:
1) have a patched rabbitmq up and running
2) if running locally, **ensure you point to a network interface** as k6 is running in a container.
2.1) example: if you're running locally, point to your ethernet/wifi card ip address

```
# example #1 - run against local rabbitmq
# 1) figure out your IP address so that k6 container can reach if
$ ifconfig
...
wlp3s0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 10.2.129.32  netmask 255.255.0.0  broadcast 10.2.255.255
...          ^^^^^^^^^^^
# 2) run performance tests
$ ./run_perftest.sh -h http://10.2.129.32:15673

# example #2 - run 500 request by 10 concurrent clients with a 100MB message
$ ./run_perftest.sh -h http://10.2.129.32:15673 --size 100 --vus 10 --iterations 500
$ ./run_perftest.sh -h http://10.2.129.32:15673 -s 100 -v 10 -i 500

# example #3 - run 1000 request by 5 user with 10MB messages to dev-re-001
./run_perftest.sh -h https://mq-admin.komgo-dev-re-001.gmk.solutions.consensys-uk.net -u admin -p SECRET -s 10 -v 5 -i 1000
```
