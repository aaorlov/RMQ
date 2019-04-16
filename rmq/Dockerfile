FROM rabbitmq:3.7.7-management

RUN apt-get update && apt-get install -y curl jq

COPY config/pre-entrypoint.sh /

COPY config/enabled_plugins config/rabbitmq.conf /etc/rabbitmq/
COPY config/rabbitmq-cluster config/password-hash-gen config/create-admin config/sms-set-lazy-queues config/setup-member /usr/local/bin/

EXPOSE 5672 15672 25672 4369 9100 9101 9102 9103 9104 9105
ENTRYPOINT ["/pre-entrypoint.sh"]
CMD ["rabbitmq-cluster"]