import math
import logging

log = logging.getLogger(__name__)


def main(trans, webhook, params):
    precision = 2
    total_size = int(trans.user.disk_usage) / float(1024 ** 3)  # in GB

    # Set precision
    if total_size < 1:
        precision = int(abs(math.floor(math.log10(total_size))) + 1)

    st = '%.' + str(precision) + 'f'
    data = {
        'size': st % total_size,
        'providers': []
    }

    try:
        for provider in webhook.config['providers']:
            data['providers'].append({
                'name': provider['name'],
                'currency': provider['currency'],
                'value': provider['name'].lower().replace(' ', '_'),
                'params': {
                    param_name: param_value
                    for param in provider['params']
                    for param_name, param_value in param.items()
                },
                'controls': provider['controls'],
                'formula': provider['formula']
            })

    except Exception as e:
        log.exception(e)

    return data
