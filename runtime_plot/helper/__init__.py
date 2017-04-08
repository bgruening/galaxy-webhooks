from collections import Counter, OrderedDict
from time import sleep
import logging
import os

from sqlalchemy import create_engine

log = logging.getLogger(__name__)


def main(trans, webhook, params):
    error = ''
    result = {}
    average = 0

    try:
        if not params or 'tool_id' not in params.keys():
            raise KeyError('Tool id is missing.')
        tool_id = params['tool_id']

        config = trans.app.config
        root_path = os.path.join(config.tool_data_path, '..')

        # Get DB connection
        if config.database_connection:
            connection = config.database_connection
        else:
            connection = 'sqlite:///%s' % os.path.join(root_path,
                                                       config.database)
        # Connect to the database
        engine = create_engine(connection)

        # Get all runtime records of a tool with id = tool_id
        query = 'SELECT jmn.metric_value AS runtime ' + \
                'FROM job_metric_numeric AS jmn ' + \
                'INNER JOIN job ' + \
                'WHERE jmn.metric_name="runtime_seconds" ' + \
                'AND job.id=jmn.job_id ' + \
                'AND job.tool_id="%s"' % tool_id

        raw_data = [x[0] for x in engine.execute(query).fetchall()]

        if raw_data:
            average = round(sum(raw_data) / float(len(raw_data)), 1)

        if average < 60:
            units = 'sec'
            data = raw_data
        elif 60 <= average < 3600:
            units = 'min'
            data = list(map(lambda x: round(x / 60, 1), raw_data))
        else:
            units = 'h'
            data = list(map(lambda x: round(x / 3600, 1), raw_data))

        original_data = data

        # Count runs
        cnt = Counter(data)

        # Distribute the counted runs into bins (columns)
        if units == 'sec' or units == 'min':
            # TODO@me: temporary solution
            data = cnt
        else:
            data = OrderedDict(
                (str(i * 4) + '-' + str(i * 4 + 4), 0)
                for i in range(6)
            )
            data['>24'] = 0

            for key, value in cnt.items():
                for i in range(6):
                    lo_b = i * 4
                    up_b = i * 4 + 4
                    if lo_b <= key < up_b:
                        data[str(lo_b) + '-' + str(up_b)] += value
                    # More than a day
                    elif key >= 24:
                        data['>24'] += value

        chart_data = [
            {
                'y': value,
                'label': key
            }
            for key, value in data.items()
        ]

        for i, item in enumerate(chart_data):
            item['x'] = (i + 1) * 10

        result = {
            'linechart_data': [{'y': y} for y in original_data],
            'data': chart_data,
            'units': units
        }

        # Buy some time for CanvasJS to load
        sleep(2)

    except Exception as e:
        error = str(e)
        log.exception(e)

    return {'success': not error, 'error': error, 'data': result}
